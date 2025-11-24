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
import { setTokenCookie } from "./utils/cookies.js";
import { createAdminRouter } from "./routes/admin.js";
import { createUserRouter } from "./routes/user.js";

// Swagger imports
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

// Load environment variables
dotenv.config({ path: dirname(fileURLToPath(import.meta.url)) + "/.env" });

const app = express();

// Base URL for server3 TTS service. Override with AI_SERVER_URL/TTS_SERVER_URL env vars in deployment.
const AI_SERVER_URL =
  process.env.AI_SERVER_URL ||
  "https://effortless-bogus-kaelyn.ngrok-free.dev/api/v1/tts";

// Swagger setup
const spec = swaggerJsdoc({
  apis: ["./server.js"], // add JSDoc comments
  definition: { openapi: "3.0.0", info: { title: "API", version: "1.0.0" } },
});
app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));

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
const adminRouter = createAdminRouter(
  db,
  STRINGS,
  requireAdminAuth,
  redirectIfAuthenticated
);
app.use("/admin", adminRouter);

/**
 * USER ROUTES
 */
const userRouter = createUserRouter(
  db,
  STRINGS,
  requireUserAuth,
  authenticateRequest,
  AI_SERVER_URL
);
app.use("/api/v1", userRouter);

// 404 handler
app.use((req, res) =>
  res
    .status(404)
    .json({ success: false, message: STRINGS.RESPONSES.NOT_FOUND })
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
