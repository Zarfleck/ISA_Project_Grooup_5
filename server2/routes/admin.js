// Admin routes

import express from "express";
import { generateToken } from "../auth.js";
import { setTokenCookie, clearTokenCookie } from "../utils/cookies.js";
import { createApiStatsMiddleware } from "../middleware/apiStats.js";

export function createAdminRouter(db, STRINGS, requireAdminAuth) {
  const adminRouter = express.Router();

  // Create admin middleware with /admin prefix
  const adminStatsMiddleware = createApiStatsMiddleware(db, STRINGS, "/admin");

  adminRouter.get("/login", (_request, response) => {
    response.status(200).json({
      success: true,
      message: "Admin login endpoint. POST credentials to authenticate.",
    });
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

  adminRouter.get("/", (_request, response) => {
    response.status(200).json({
      success: true,
      message: "Admin API root. POST to /admin/login to begin.",
    });
  });

  // Add new admin route
  adminRouter.get("/add-admin", (_request, response) => {
    response.status(200).json({
      success: true,
      message:
        "Send POST /admin/add-admin with email and password to create an admin.",
    });
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
    clearTokenCookie(response);
    return response.status(200).json({
      success: true,
      message: STRINGS.LOGOUT.SUCCESS,
    });
  });

  // Admin dashboard route
  /**
   * @swagger
   * /admin/dashboard:
   *   get:
   *     summary: Fetch admin dashboard data (users and API usage stats).
   *     tags: [Admin]
   *     security:
   *       - CookieAuth: []
   *     responses:
   *       200:
   *         description: Dashboard data for the authenticated admin.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 admin:
   *                   type: object
   *                   properties:
   *                     userId:
   *                       type: integer
   *                     email:
   *                       type: string
   *                 users:
   *                   type: array
   *                   items:
   *                     type: object
   *                 endpointStats:
   *                   type: array
   *                   items:
   *                     type: object
   *       401:
   *         description: Missing or invalid admin session.
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
  adminRouter.get(
    "/dashboard",
    adminStatsMiddleware,
    requireAdminAuth,
    async (request, response) => {
      try {
        const users = await db.getAllUsersWithApiUsage();
        const endpointStats = await db.getEndpointStatistics();

        return response.status(200).json({
          success: true,
          admin: {
            userId: request.admin?.user_id,
            email: request.admin?.email,
          },
          users,
          endpointStats,
        });
      } catch (error) {
        console.error(STRINGS.LOGS.ADMIN_DASHBOARD_ERROR_PREFIX, error.message);
        return response.status(500).json({
          success: false,
          message: STRINGS.RESPONSES.ERROR_SERVER,
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

  return adminRouter;
}
