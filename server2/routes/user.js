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
  /**
   * @swagger
   * /api/v1/auth/signup:
   *   post:
   *     summary: Register a new user account and issue a JWT cookie.
   *     tags: [User Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: "#/components/schemas/AuthCredentials"
   *     responses:
   *       200:
   *         description: User created.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/SignupResponse"
   *       400:
   *         description: Missing fields or email already exists.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/ErrorResponse"
   *       500:
   *         description: Database or server error.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/ErrorResponse"
   */
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
  /**
   * @swagger
   * /api/v1/auth/login:
   *   post:
   *     summary: Authenticate an existing user and issue a JWT cookie.
   *     tags: [User Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: "#/components/schemas/AuthCredentials"
   *     responses:
   *       200:
   *         description: User authenticated.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/LoginResponse"
   *       400:
   *         description: Missing email or password.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/ErrorResponse"
   *       401:
   *         description: Invalid credentials.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/ErrorResponse"
   */
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

      const passwordValid = await db.verifyPassword(
        password,
        user.password_hash
      );
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
  /**
   * @swagger
   * /api/v1/auth/me:
   *   get:
   *     summary: Fetch the currently authenticated user's profile and quota.
   *     tags: [User Auth]
   *     security:
   *       - CookieAuth: []
   *     responses:
   *       200:
   *         description: Authenticated user info.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/MeResponse"
   *       401:
   *         description: Missing or invalid session.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/ErrorResponse"
   */
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
  /**
   * @swagger
   * /api/v1/tts/synthesize:
   *   post:
   *     summary: Convert text to speech via the AI proxy while enforcing quotas.
   *     tags: [Text to Speech]
   *     security:
   *       - CookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: "#/components/schemas/TtsRequest"
   *     responses:
   *       200:
   *         description: Audio generated successfully.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/TtsResponse"
   *       400:
   *         description: Missing text or language.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/ErrorResponse"
   *       401:
   *         description: Missing or invalid user session.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/ErrorResponse"
   *       429:
   *         description: API quota exceeded.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/ErrorResponse"
   *       503:
   *         description: Upstream TTS service unavailable.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/ErrorResponse"
   */
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
          limitExceeded: apiLimit.exceeded,
        };

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
            apiLimitExceeded: apiLimit.exceeded,
            ...(apiLimit.exceeded
              ? { warning: STRINGS.RESPONSES.ERROR_API_LIMIT }
              : {}),
          });
        }

        if (!language) {
          return response.status(400).json({
            success: false,
            message: STRINGS.TTS.LANGUAGE_REQUIRED,
            apiUsage,
            apiLimitExceeded: apiLimit.exceeded,
            ...(apiLimit.exceeded
              ? { warning: STRINGS.RESPONSES.ERROR_API_LIMIT }
              : {}),
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
              aiData?.detail || aiData?.message || STRINGS.TTS.SERVICE_ERROR,
            apiUsage,
            apiLimitExceeded: apiLimit.exceeded,
            ...(apiLimit.exceeded
              ? { warning: STRINGS.RESPONSES.ERROR_API_LIMIT }
              : {}),
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
          limitExceeded:
            updatedUsage.api_calls_used >= updatedUsage.api_calls_limit,
        };
        const usageLimitExceeded =
          refreshedUsage.limitExceeded || refreshedUsage.remaining <= 0;

        return response.status(200).json({
          success: true,
          ...aiData,
          apiUsage: refreshedUsage,
          apiLimitExceeded: usageLimitExceeded,
          ...(usageLimitExceeded
            ? { warning: STRINGS.RESPONSES.ERROR_API_LIMIT }
            : {}),
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
  /**
   * @swagger
   * /api/v1/auth/logout:
   *   post:
   *     summary: Clear the JWT cookie for the current session.
   *     tags: [User Auth]
   *     security:
   *       - CookieAuth: []
   *     responses:
   *       200:
   *         description: Session cleared.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/MessageResponse"
   *       500:
   *         description: Server error clearing the session.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/ErrorResponse"
   */
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
  /**
   * @swagger
   * /api/v1/usage/increment:
   *   post:
   *     summary: Increment the calling user's API usage counter.
   *     tags: [Usage]
   *     security:
   *       - CookieAuth: []
   *     responses:
   *       200:
   *         description: Usage counter incremented.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/MessageResponse"
   *       401:
   *         description: Not authenticated.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/ErrorResponse"
   *       500:
   *         description: Server error.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/ErrorResponse"
   */
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
