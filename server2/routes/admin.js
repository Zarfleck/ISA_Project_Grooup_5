// Admin routes

import express from "express";
import { generateToken } from "../auth.js";
import { setTokenCookie, clearTokenCookie } from "../utils/cookies.js";
import { createApiStatsMiddleware } from "../middleware/apiStats.js";

export function createAdminRouter(db, STRINGS, requireAdminAuth, redirectIfAuthenticated) {
  const adminRouter = express.Router();

  // Create admin middleware with /admin prefix
  const adminStatsMiddleware = createApiStatsMiddleware(db, STRINGS, "/admin");

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
    clearTokenCookie(response);
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

  return adminRouter;
}

