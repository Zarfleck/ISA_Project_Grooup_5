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

// Set EJS as the templating engine
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

app.use(express.json());
app.use(cookieParser());

// CORS setup that reflects origin and supports credentials
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:8080",
      "https://4537fe.netlify.app",
      "https://isa-server1.netlify.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
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
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
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
      firstName: user.first_name || "",
      lastName: user.last_name || "",
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
      token,
      user: {
        userId: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
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
    const { email, password, firstName, lastName } = request.body || {};

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
    const result = await db.insertUser(
      email,
      passwordHash,
      firstName || null,
      lastName || null,
      true
    );

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
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
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
    const { email, password, firstName, lastName } = request.body || {};

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
    const result = await db.insertUser(
      email,
      passwordHash,
      firstName || null,
      lastName || null
    );

    if (!result?.success) {
      return response.status(400).json(result);
    }

    const token = generateToken(result.userId, email);
    setTokenCookie(response, token);

    return response.status(200).json({
      success: true,
      message: STRINGS.SIGNUP.USER_REGISTERED,
      token,
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
      token,
      user: {
        userId: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
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
        firstName: user.first_name,
        lastName: user.last_name,
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

// Logout route
userRouter.post("/auth/logout", (request, response) => {
  try {
    response.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
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

  const port = process.env.PORT || process.env.SERVER_PORT || 3000;
  const host = process.env.SERVER_HOST || "0.0.0.0";

  app.listen(port, host, () => {
    console.log(`${STRINGS.SERVER.STARTUP} ${port} on ${host}`);
  });
}

process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  await db.close();
  process.exit(0);
});

await start();
