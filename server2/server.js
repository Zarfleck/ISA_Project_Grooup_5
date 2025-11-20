/*
Claude Sonnet 4 (https://claude.ai/) was used to generate the following code solutions in this assignment:

    1. API Route Handling - The handleInsertDefault(), handleCustomQuery(), and handleGetQuery() functions for processing different types of database operations.

    2. Error Handling - Comprehensive try-catch blocks with proper HTTP status codes and JSON error responses.

    3. Database Integration - The server startup sequence with database connection validation and graceful shutdown handling.

*/

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path, { dirname } from "path";
import Database from "./database.js";
import STRINGS from "./lang/messages/en/user.js";
import {
  generateToken,
  verifyToken,
  extractTokenFromCookie,
  extractTokenFromHeader,
} from "./auth.js";

// Load environment variables
dotenv.config({ path: dirname(fileURLToPath(import.meta.url)) + "/.env" });

const app = express();

// Base URL for server3 TTS service. Override with AI_SERVER_URL/TTS_SERVER_URL env vars in deployment.
const AI_SERVER_URL =
  process.env.AI_SERVER_URL ||
  "https://effortless-bogus-kaelyn.ngrok-free.dev/api/v1/tts";

// Set EJS as the templating engine
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

app.use(express.json());
app.use(cookieParser());

// Trust proxy is required for Secure cookies behind load balancers
app.set("trust proxy", 1);

// CORS setup that reflects origin and supports credentials
const allowedOrigins =
  process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) || [];
const defaultOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:8080",
  "https://isa-server1.netlify.app",
];

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : defaultOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// app.options("*", cors());

// Initialize DB connection
const db = new Database();

// Helper to set token cookie similar to server.js
function setTokenCookie(response, token) {
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
  response.cookie("token", token, cookieOptions);
}

//==============================================================//
// authenticateRequest function to get user from request
export async function authenticateRequest(request) {
  try {
    const token =
      request.cookies?.token ||
      extractTokenFromCookie(request.headers.cookie) ||
      extractTokenFromHeader(request.headers.authorization);

    if (!token) return null;

    const decoded = verifyToken(token);
    if (!decoded?.userId) return null;

    return await db.getUserById(decoded.userId);
  } catch (error) {
    console.error("Authentication error:", error);
    return null;
  }
}

//==============================//Middleware//==============================//
// Middleware for admin route protection
export async function requireAdminAuth(request, response, next) {
  try {
    const token =
      request.cookies?.token ||
      extractTokenFromCookie(request.headers.cookie) ||
      extractTokenFromHeader(request.headers.authorization);
    if (!token) return response.redirect("/admin/login");

    const decoded = verifyToken(token);
    const user = await db.findUserByEmail(decoded.email);

    if (!user || !user.is_admin) return response.redirect("/admin/login");

    // Make admin info available in views
    response.locals.admin = {
      email: user.email,
    };

    request.admin = user; // for backend access
    next();
  } catch (err) {
    console.error("Admin auth middleware error:", err.message);
    response.redirect("/admin/login");
  }
}

export function redirectIfAuthenticated(req, res, next) {
  if (req.cookies?.token) return res.redirect("/admin/dashboard");
  next();
}

//==============================//Routes//==============================//
/**
 * ADMIN ROUTES
 */
const adminRouter = express.Router();

adminRouter.get("/login", (request, response) => {
  response.render("login");
});

adminRouter.post("/login", async (request, response) => {
  try {
    const { email, password } = request.body || {};
    if (!email || !password) {
      return response
        .status(400)
        .json({ success: false, message: STRINGS.LOGIN.FIELDS_REQUIRED });
    }

    const user = await db.findUserByEmail(email);
    if (!user || !user.is_admin) {
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

    const token = generateToken(user.user_id, user.email);
    setTokenCookie(response, token);

    return response.status(200).json({
      success: true,
      message: STRINGS.LOGIN.LOGIN_SUCCESS,
      user: {
        userId: user.user_id,
        email: user.email,
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

adminRouter.get("/", redirectIfAuthenticated, (request, response) => {
  response.redirect("/admin/login");
});

// Add new admin route
adminRouter.get("/add-admin", (request, response) => {
  response.render("add-admin");
});

adminRouter.post("/add-admin", async (request, response) => {
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

    const passwordHash = await db.hashPassword(password);
    const result = await db.insertUser(email, passwordHash, true);

    if (!result?.success) {
      return response.status(400).json(result);
    }

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

// Admin logout route
adminRouter.get("/logout", (request, response) => {
  response.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/",
  });
  response.redirect("/admin/login");
});

// Admin dashboard route
adminRouter.get("/dashboard", requireAdminAuth, async (request, response) => {
  const users = await db.getAllUsersWithApiUsage();
  response.render("admin-dashboard", {
    currentAdmin: response.locals.admin,
    users,
  });
});

// Mount under /admin
app.use("/admin", adminRouter);

/**
 * USER ROUTES
 */
const userRouter = express.Router();

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
userRouter.get("/auth/me", async (request, response) => {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return response.status(401).json({
        success: false,
        message: STRINGS.RESPONSES.ERROR_AUTHENTICATION,
      });
    }

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
userRouter.post("/tts/synthesize", async (request, response) => {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return response.status(401).json({
        success: false,
        message: STRINGS.RESPONSES.ERROR_AUTHENTICATION,
      });
    }

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
        message: "Text is required to synthesize speech",
        apiUsage,
      });
    }

    if (!language) {
      return response.status(400).json({
        success: false,
        message: "Language is required to synthesize speech",
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
      console.error("Failed to parse AI response:", jsonError);
      aiData = {};
    }

    if (!aiResponse.ok) {
      return response.status(aiResponse.status).json({
        success: false,
        message:
          aiData?.detail ||
          aiData?.message ||
          "Text-to-speech service returned an error",
        apiUsage,
      });
    }

    await db.incrementApiCalls(user.user_id);
    await db.logApiUsage(user.user_id, "/tts/synthesize", "POST");

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
    console.error("TTS proxy error:", error);
    return response.status(500).json({
      success: false,
      message: STRINGS.RESPONSES.ERROR_SERVER,
      error: error.message,
    });
  }
});

// Logout route
userRouter.post("/auth/logout", (request, response) => {
  try {
    response.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      path: "/",
    });

    return response.status(200).json({
      success: true,
      message: STRINGS.LOGOUT?.SUCCESS || "Logged out successfully",
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
      message: "API call limit increased",
    });
  } catch (error) {
    return response.status(500).json({
      success: false,
      message: STRINGS.RESPONSES.ERROR_SERVER,
      error: error.message,
    });
  }
});

// Mount under /api
app.use("/api", userRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).render("404", { title: "Page Not Found" });
});

// Start server after DB connects
async function start() {
  const connected = await db.connect();
  if (!connected) {
    console.error("Failed to connect to database. Exiting...");
    process.exit(1);
  }

  app.listen(process.env.PORT, () => {
    console.log(`${STRINGS.SERVER.STARTUP} ${process.env.PORT || 3000}`);
  });
}

process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  await db.close();
  process.exit(0);
});

await start();
