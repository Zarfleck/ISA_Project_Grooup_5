/*
Claude Sonnet 4 (https://claude.ai/) was used to generate the following code solutions in this assignment:

    1. API Route Handling - The handleInsertDefault(), handleCustomQuery(), and handleGetQuery() functions for processing different types of database operations.

    2. Error Handling - Comprehensive try-catch blocks with proper HTTP status codes and JSON error responses.

    3. Database Integration - The server startup sequence with database connection validation and graceful shutdown handling.

GPT-4o (ChatGPT) helped set up Swagger documentation and configuration.
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
import { setTokenCookie } from "./utils/cookies.js";

// Swagger imports
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

// Load environment variables
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();

// Base URL for server3 TTS service. Override with AI_SERVER_URL/TTS_SERVER_URL env vars in deployment.
const AI_SERVER_URL =
  process.env.AI_SERVER_URL ||
  "https://effortless-bogus-kaelyn.ngrok-free.dev/api/v1/tts";

// Swagger setup
const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "TTS API",
    version: "1.0.0",
    description:
      "Authentication, admin controls, quota tracking, and text-to-speech proxy endpoints.",
  },
  tags: [
    {
      name: "User Auth",
      description: "Signup, login, and session lookups for end users.",
    },
    {
      name: "Usage",
      description: "API quota helpers and usage counters.",
    },
    {
      name: "Text to Speech",
      description: "Voice synthesis proxy to the AI service.",
    },
    {
      name: "Admin",
      description: "Admin authentication and user management.",
    },
  ],
  components: {
    securitySchemes: {
      CookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "token",
        description: "JWT issued on login or signup.",
      },
    },
    schemas: {
      AuthCredentials: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "user@example.com",
          },
          password: {
            type: "string",
            format: "password",
            example: "P@ssw0rd!",
          },
        },
      },
      UserProfile: {
        type: "object",
        properties: {
          userId: { type: "integer", example: 12 },
          email: { type: "string", format: "email" },
          apiCallsUsed: { type: "integer", example: 3 },
          apiCallsLimit: { type: "integer", example: 20 },
          apiLimitExceeded: { type: "boolean", example: false },
        },
      },
      ApiUsage: {
        type: "object",
        properties: {
          used: { type: "integer", example: 2 },
          limit: { type: "integer", example: 20 },
          remaining: { type: "integer", example: 18 },
        },
      },
      SignupResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "User registered successfully" },
          userId: { type: "integer", example: 42 },
        },
      },
      LoginResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string" },
          user: {
            type: "object",
            properties: {
              userId: { type: "integer" },
              email: { type: "string", format: "email" },
              apiCallsUsed: { type: "integer" },
              apiCallsLimit: { type: "integer" },
            },
          },
        },
      },
      MeResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          user: { $ref: "#/components/schemas/UserProfile" },
        },
      },
      MessageResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string" },
        },
      },
      TtsRequest: {
        type: "object",
        required: ["text"],
        properties: {
          text: { type: "string", example: "Hello from the API" },
          language: { type: "string", default: "en" },
          speaker_id: { type: "string", example: "default" },
          speaker_wav_base64: {
            type: "string",
            description: "Override speaker with a base64 encoded WAV clip.",
          },
          speaker_wav_url: {
            type: "string",
            format: "uri",
            description: "External WAV file to clone a voice.",
          },
        },
      },
      TtsResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          format: { type: "string", example: "wav" },
          audio_base64: {
            type: "string",
            description: "Base64 encoded audio payload.",
          },
          duration_seconds: { type: "number", nullable: true, example: 1.4 },
          sample_rate: { type: "integer", example: 24000 },
          apiUsage: { $ref: "#/components/schemas/ApiUsage" },
        },
      },
      ResetUsageResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string" },
          apiUsage: {
            type: "object",
            properties: {
              used: { type: "integer", example: 0 },
              limit: { type: "integer", example: 20 },
            },
          },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string" },
          error: { type: "string" },
          apiUsage: { $ref: "#/components/schemas/ApiUsage" },
        },
      },
    },
  },
};

const swaggerSpec = swaggerJsdoc({
  apis: [path.join(__dirname, "*.js")],
  definition: swaggerDefinition,
});

// Serve Swagger UI and raw JSON for troubleshooting
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, { explorer: true })
);
app.get("/docs.json", (_req, res) =>
  res.type("application/json").send(swaggerSpec)
);

// Set EJS as the templating engine
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

app.use(express.json());
app.use(cookieParser());

// Trust proxy is required for Secure cookies behind load balancers
app.set("trust proxy", 1);

// CORS setup that reflects origin and supports credentials
const allowedOrigins =
  process.env.ALLOWED_ORIGINS?.split(",")
    .map((o) => o.trim())
    .filter(Boolean) || [];
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
    console.error(STRINGS.LOGS.AUTH_ERROR_PREFIX, error);
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

    // Switch to admin role for admin operations
    await db.switchToAdminRole();

    // Make admin info available in views
    response.locals.admin = {
      email: user.email,
    };

    request.admin = user; // for backend access
    next();
  } catch (err) {
    console.error(STRINGS.LOGS.ADMIN_AUTH_ERROR_PREFIX, err.message);
    response.redirect("/admin/login");
  }
}

export function redirectIfAuthenticated(req, res, next) {
  if (req.cookies?.token) return res.redirect("/admin/dashboard");
  next();
}

// Middleware for user route protection
export async function requireUserAuth(request, response, next) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return response.status(401).json({
        success: false,
        message: STRINGS.RESPONSES.ERROR_AUTHENTICATION,
      });
    }

    // Switch to user role for limited privileges
    await db.switchToUserRole();

    request.user = user;
    next();
  } catch (err) {
    console.error(STRINGS.LOGS.USER_AUTH_ERROR_PREFIX, err.message);
    response.status(500).json({
      success: false,
      message: STRINGS.RESPONSES.ERROR_SERVER,
    });
  }
}

//==============================//Routes//==============================//
/**
 * ADMIN ROUTES
 */
const adminRouter = express.Router();

// createApiStatsMiddleware variable is created by Claude Sonnet 4 (https://claude.ai/)
// Universal API logging middleware factory - creates middleware for any route type
const createApiStatsMiddleware = (pathPrefix = "") => {
  return async (req, res, next) => {
    // Store original end function
    const originalEnd = res.end;

    // Override end function to log after response
    res.end = function (...args) {
      // Call original end function first
      originalEnd.apply(this, args);

      // Log API usage asynchronously (don't block response)
      const user = req.user || req.admin; // Works for both user and admin routes
      if (user && req.path.startsWith("/")) {
        // Use setImmediate to avoid blocking the response
        setImmediate(async () => {
          try {
            const fullPath = pathPrefix + req.path;
            await db.logApiUsage(user.user_id, fullPath, req.method, "en");
          } catch (error) {
            console.error(STRINGS.LOGS.API_LOGGING_ERROR_PREFIX, error.message);
          }
        });
      }
    };

    next();
  };
};

// Create admin middleware with /admin prefix
const adminStatsMiddleware = createApiStatsMiddleware("/admin");

adminRouter.get("/login", (request, response) => {
  response.render("login");
});

/**
 * @swagger
 * /admin/login:
 *   post:
 *     summary: Authenticate an admin and issue a JWT cookie.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/AuthCredentials"
 *     responses:
 *       200:
 *         description: Admin authenticated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/LoginResponse"
 *       400:
 *         description: Missing required fields.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *       401:
 *         description: Invalid admin credentials.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */
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

/**
 * @swagger
 * /admin/add-admin:
 *   post:
 *     summary: Create a new admin user.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/AuthCredentials"
 *     responses:
 *       200:
 *         description: Admin account created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/SignupResponse"
 *       400:
 *         description: Missing fields or duplicate email.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *       500:
 *         description: Database or server error while creating the admin.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */
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
adminRouter.get(
  "/dashboard",
  adminStatsMiddleware,
  requireAdminAuth,
  async (request, response) => {
    try {
      const users = await db.getAllUsersWithApiUsage();
      const endpointStats = await db.getEndpointStatistics();

      response.render("admin-dashboard", {
        currentAdmin: response.locals.admin,
        users,
        endpointStats,
      });
    } catch (error) {
      console.error(STRINGS.LOGS.ADMIN_DASHBOARD_ERROR_PREFIX, error.message);
      response.render("admin-dashboard", {
        currentAdmin: response.locals.admin,
        users: [],
        endpointStats: [],
      });
    }
  }
);

// DELETE /admin/users/:id - Admin delete user endpoint
/**
 * @swagger
 * /admin/users/{id}:
 *   delete:
 *     summary: Delete a non-admin user account.
 *     tags: [Admin]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the user to delete.
 *     responses:
 *       200:
 *         description: User deleted.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/MessageResponse"
 *       400:
 *         description: Invalid or missing user id.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *       401:
 *         description: Missing or invalid admin session.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *       403:
 *         description: Attempt to delete an admin account.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */
adminRouter.delete(
  "/users/:id",
  adminStatsMiddleware,
  requireAdminAuth,
  async (request, response) => {
    try {
      const userId = parseInt(request.params.id);

      // Validate user ID
      if (!userId || isNaN(userId)) {
        return response.status(400).json({
          success: false,
          message: STRINGS.ADMIN.INVALID_USER_ID,
        });
      }

      // Prevent admin from deleting themselves
      if (userId === request.admin.user_id) {
        return response.status(400).json({
          success: false,
          message: STRINGS.ADMIN.CANNOT_DELETE_SELF,
        });
      }

      // Check if target user exists and get their info
      const targetUser = await db.getUserById(userId);
      if (!targetUser) {
        return response.status(404).json({
          success: false,
          message: STRINGS.ADMIN.USER_NOT_FOUND,
        });
      }

      // Prevent deletion of admin users
      if (targetUser.is_admin) {
        return response.status(403).json({
          success: false,
          message: STRINGS.ADMIN.CANNOT_DELETE_ADMIN,
        });
      }

      // Delete user using database method
      const result = await db.deleteUser(userId);

      if (result.success) {
        return response.status(200).json({
          success: true,
          message: result.message,
        });
      } else {
        return response.status(500).json({
          success: false,
          message: result.message || STRINGS.RESPONSES.ERROR_SERVER,
        });
      }
    } catch (error) {
      console.error(STRINGS.LOGS.DELETE_USER_ERROR_PREFIX, error.message);
      return response.status(500).json({
        success: false,
        message: STRINGS.RESPONSES.ERROR_SERVER,
      });
    }
  }
);

// PATCH /admin/users/:id/reset-usage - Admin reset user API usage
/**
 * @swagger
 * /admin/users/{id}/reset-usage:
 *   patch:
 *     summary: Reset a user's API usage counters.
 *     tags: [Admin]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID whose usage will be reset.
 *     responses:
 *       200:
 *         description: Usage counters reset.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ResetUsageResponse"
 *       400:
 *         description: Invalid user id provided.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *       401:
 *         description: Missing or invalid admin session.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */
adminRouter.patch(
  "/users/:id/reset-usage",
  adminStatsMiddleware,
  requireAdminAuth,
  async (request, response) => {
    try {
      const userId = parseInt(request.params.id);

      // Validate user ID
      if (!userId || isNaN(userId)) {
        return response.status(400).json({
          success: false,
          message: STRINGS.ADMIN.INVALID_USER_ID,
        });
      }

      // Check if user exists
      const user = await db.getUserById(userId);
      if (!user) {
        return response.status(404).json({
          success: false,
          message: STRINGS.ADMIN.USER_NOT_FOUND,
        });
      }

      // Reset API usage using database method
      const result = await db.resetUserApiUsage(userId);

      if (result.success) {
        // Get updated usage info
        const updatedUsage = await db.getUserApiUsage(userId);

        return response.status(200).json({
          success: true,
          message: result.message,
          apiUsage: {
            used: updatedUsage.api_calls_used,
            limit: updatedUsage.api_calls_limit,
          },
        });
      } else {
        return response.status(500).json({
          success: false,
          message: result.message || STRINGS.RESPONSES.ERROR_SERVER,
        });
      }
    } catch (error) {
      console.error(STRINGS.LOGS.RESET_USAGE_ERROR_PREFIX, error.message);
      return response.status(500).json({
        success: false,
        message: STRINGS.RESPONSES.ERROR_SERVER,
      });
    }
  }
);

// Mount under /admin
app.use("/admin", adminRouter);

/**
 * USER ROUTES
 */
const userRouter = express.Router();

// Create user middleware with no prefix (standard API paths)
const apiStatsMiddleware = createApiStatsMiddleware("");

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
            aiData?.detail || aiData?.message || STRINGS.TTS.SERVICE_ERROR,
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
    response.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      path: "/",
    });

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
 *     summary: Increment the calling user's API usage counter (testing helper).
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

// Mount under /api/v1
app.use("/api/v1", userRouter);

// 404 handler
app.use((req, res) =>
  res.status(404).json({ success: false, message: STRINGS.RESPONSES.NOT_FOUND })
);

// Start server after DB connects
async function start() {
  const connected = await db.connect();
  if (!connected) {
    console.error(STRINGS.LOGS.DB_CONNECT_FAILURE);
    process.exit(1);
  }

  app.listen(process.env.PORT, () => {
    console.log(`${STRINGS.SERVER.STARTUP} ${process.env.PORT || 3000}`);
  });
}

process.on("SIGINT", async () => {
  console.log(STRINGS.LOGS.SERVER_SHUTDOWN);
  await db.close();
  process.exit(0);
});

await start();
