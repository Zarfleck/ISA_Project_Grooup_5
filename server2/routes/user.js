// User routes

import express from "express";
import { generateToken } from "../auth.js";
import { setTokenCookie, clearTokenCookie } from "../utils/cookies.js";
import { createApiStatsMiddleware } from "../middleware/apiStats.js";

export function createUserRouter(
  db,
  STRINGS,
  requireUserAuth,
  authenticateRequest,
  AI_SERVER_URL
) {
  const userRouter = express.Router();

  // Create user middleware with no prefix (standard API paths)
  const apiStatsMiddleware = createApiStatsMiddleware(db, STRINGS, "");

  // Apply API logging middleware to all user routes
  userRouter.use(apiStatsMiddleware);

  // Signup route
  userRouter.post("/auth/signup", async (request, response) => {
    try {
      const { email, password } = request.body || {};

      if (!email || !password) {
        return response
          .status(400)
          .json({ success: false, message: STRINGS.SIGNUP.FIELDS_REQUIRED });
      }

      const existingUser = await db.findUserByEmail(email);
      if (existingUser) {
        return response.status(400).json({
          success: false,
          message: STRINGS.SIGNUP.EMAIL_EXISTS,
        });
      }

      // Hash password and create user
      const passwordHash = await db.hashPassword(password);
      const result = await db.insertUser(email, passwordHash);

      if (!result?.success) {
        return response.status(400).json(result);
      }

      const token = generateToken(result.userId, email);
      setTokenCookie(response, token);

      return response.status(200).json({
        success: true,
        message: STRINGS.SIGNUP.USER_REGISTERED,
        userId: result.userId,
      });
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: STRINGS.RESPONSES.ERROR_SERVER,
        error: error.message,
      });
    }
  });

  // Login route
  userRouter.post("/auth/login", async (request, response) => {
    try {
      const { email, password } = request.body || {};
      if (!email || !password) {
        return response
          .status(400)
          .json({ success: false, message: STRINGS.LOGIN.FIELDS_REQUIRED });
      }

      const user = await db.findUserByEmail(email);
      if (!user) {
        return response.status(401).json({
          success: false,
          message: STRINGS.RESPONSES.ERROR_AUTHENTICATION,
        });
      }

      const passwordValid = await db.verifyPassword(password, user.password_hash);
      if (!passwordValid) {
        return response.status(401).json({
          success: false,
          message: STRINGS.RESPONSES.ERROR_AUTHENTICATION,
        });
      }

      await db.updateLastLogin(user.user_id);

      const token = generateToken(user.user_id, user.email);
      setTokenCookie(response, token);

      // Get API usage from user_api table
      const apiUsage = await db.getUserApiUsage(user.user_id);

      return response.status(200).json({
        success: true,
        message: STRINGS.LOGIN.LOGIN_SUCCESS,
        user: {
          userId: user.user_id,
          email: user.email,
          apiCallsUsed: apiUsage.api_calls_used,
          apiCallsLimit: apiUsage.api_calls_limit,
        },
      });
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: STRINGS.RESPONSES.ERROR_SERVER,
        error: error.message,
      });
    }
  });

  // Current user info route
  userRouter.get("/auth/me", requireUserAuth, async (request, response) => {
    try {
      const user = request.user; // Set by requireUserAuth middleware

      const apiLimit = await db.checkApiLimit(user.user_id);
      const apiUsage = await db.getUserApiUsage(user.user_id);

      return response.status(200).json({
        success: true,
        user: {
          userId: user.user_id,
          email: user.email,
          apiCallsUsed: apiUsage.api_calls_used,
          apiCallsLimit: apiUsage.api_calls_limit,
          apiLimitExceeded: apiLimit.exceeded,
        },
      });
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: STRINGS.RESPONSES.ERROR_SERVER,
        error: error.message,
      });
    }
  });

  // TTS proxy: authenticate, check quota, call server3, and persist usage
  userRouter.post(
    "/tts/synthesize",
    requireUserAuth,
    async (request, response) => {
      try {
        const user = request.user; // Set by requireUserAuth middleware

        const apiLimit = await db.checkApiLimit(user.user_id);
        const apiUsage = {
          used: apiLimit.used,
          limit: apiLimit.limit,
          remaining: Math.max(apiLimit.limit - apiLimit.used, 0),
        };

        if (apiLimit.exceeded) {
          return response.status(429).json({
            success: false,
            message: STRINGS.RESPONSES.ERROR_API_LIMIT,
            apiUsage,
          });
        }

        const {
          text,
          language = "en",
          speaker_id: speakerId = "default",
          speaker_wav_base64: speakerWavBase64,
          speaker_wav_url: speakerWavUrl,
        } = request.body || {};

        if (!text) {
          return response.status(400).json({
            success: false,
            message: STRINGS.TTS.TEXT_REQUIRED,
            apiUsage,
          });
        }

        if (!language) {
          return response.status(400).json({
            success: false,
            message: STRINGS.TTS.LANGUAGE_REQUIRED,
            apiUsage,
          });
        }

        const aiResponse = await fetch(`${AI_SERVER_URL}/synthesize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            language: language,
            speaker_id: speakerId,
            speaker_wav_base64: speakerWavBase64,
            speaker_wav_url: speakerWavUrl,
          }),
        });

        let aiData;
        try {
          aiData = await aiResponse.json();
        } catch (jsonError) {
          console.error(STRINGS.TTS.PARSE_ERROR_PREFIX, jsonError);
          aiData = {};
        }

        if (!aiResponse.ok) {
          return response.status(aiResponse.status).json({
            success: false,
            message:
              aiData?.detail ||
              aiData?.message ||
              STRINGS.TTS.SERVICE_ERROR,
            apiUsage,
          });
        }

        await db.incrementApiCalls(user.user_id);
        await db.logApiUsage(user.user_id, "/tts/synthesize", "POST", language);

        const updatedUsage = await db.getUserApiUsage(user.user_id);
        const refreshedUsage = {
          used: updatedUsage.api_calls_used,
          limit: updatedUsage.api_calls_limit,
          remaining: Math.max(
            updatedUsage.api_calls_limit - updatedUsage.api_calls_used,
            0
          ),
        };

        return response.status(200).json({
          success: true,
          ...aiData,
          apiUsage: refreshedUsage,
        });
      } catch (error) {
        console.error(STRINGS.LOGS.TTS_PROXY_ERROR_PREFIX, error);
        return response.status(500).json({
          success: false,
          message: STRINGS.RESPONSES.ERROR_SERVER,
          error: error.message,
        });
      }
    }
  );

  // Logout route
  userRouter.post("/auth/logout", (request, response) => {
    try {
      clearTokenCookie(response);

      return response.status(200).json({
        success: true,
        message: STRINGS.LOGOUT.SUCCESS,
      });
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: STRINGS.RESPONSES.ERROR_SERVER,
        error: error.message,
      });
    }
  });

  // Increase API call route temporarily used for testing (behaving differently between prod and dev)
  userRouter.post("/usage/increment", async (request, response) => {
    try {
      const user = await authenticateRequest(request);
      if (!user) {
        return response.status(401).json({
          success: false,
          message: STRINGS.RESPONSES.ERROR_AUTHENTICATION,
        });
      }

      await db.incrementApiCalls(user.user_id);
      return response.status(200).json({
        success: true,
        message: STRINGS.API_USAGE.LIMIT_INCREASED,
      });
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: STRINGS.RESPONSES.ERROR_SERVER,
        error: error.message,
      });
    }
  });

  return userRouter;
}

