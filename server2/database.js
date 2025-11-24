/*

Claude Sonnet 4 (https://claude.ai/) was used to generate the following code solutions in this assignment:
  
  1. Audio Book Database Schema - Complete table creation logic with proper relationships for users, voices, languages, audio generations, and user preferences.
  
  2. Security Methods - The isQuerySafe() and executeQuery() methods for blocking dangerous SQL operations while allowing safe SELECT and INSERT queries.

  3. Database Class Structure - Object-oriented approach using ES6 classes for organizing Audio Book database operations and connection management.

  4. Default Data Management - Methods for inserting test users, voices, and languages required for the Audio Book application.

*/

import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import STRINGS from "./lang/messages/en/user.js";

class Database {
  constructor() {
    this.connection = null;
    this.currentRole = 'user'; // Track current database role
  }

  async connect() {
    try {
      console.log("DB Config:", {
        host: process.env.MYSQL_HOST,
        port: process.env.MYSQL_PORT,
        user: process.env.MYSQL_USER,
        database: process.env.MYSQL_DATABASE,
      });

      this.connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        port: process.env.MYSQL_PORT,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
      });

      console.log(STRINGS.SERVER.DB_CONNECTED);
      await this.createTable();
      await this.insertDefaultData();
      return true;
    } catch (error) {
      console.error(STRINGS.SERVER.DB_ERROR, error.message);
      return false;
    }
  }

  // This block of code below was assisted by Claude Sonnet 4 (https://claude.ai/)
  async createTable() {
    try {
      // Create all Audio Book database tables
      await this.connection.execute(STRINGS.CREATE_TABLES_QUERIES.USER_TABLE);
      await this.connection.execute(STRINGS.CREATE_TABLES_QUERIES.USER_API_TABLE);
      await this.connection.execute(
        STRINGS.CREATE_TABLES_QUERIES.USER_API_TABLE
      );
      await this.connection.execute(
        STRINGS.CREATE_TABLES_QUERIES.API_USAGE_LOG_TABLE
      );

      console.log(STRINGS.SERVER.TABLES_CREATED);
    } catch (error) {
      console.error("Table creation error:", error.message);
      throw error;
    }
  }

  // This block of code below was assisted by Claude Sonnet 4 (https://claude.ai/)
  async insertUser(
    email,
    passwordHash,
    isAdmin = false
  ) {
    try {
      const [result] = await this.connection.execute(
        "INSERT INTO user (email, password_hash, is_admin) VALUES (?, ?, ?)",
        [email, passwordHash, isAdmin]
      );

      // Create corresponding entry in user_api table
      await this.connection.execute(
        "INSERT INTO user_api (user_id, api_calls_used, api_calls_limit) VALUES (?, 0, 20)",
        [result.insertId]
      );

      return {
        success: true,
        message: STRINGS.RESPONSES.SUCCESS_INSERT,
        insertId: result.insertId,
        userId: result.insertId,
      };
    } catch (error) {
      console.error("Insert user error:", error.message);
      if (error.code === "ER_DUP_ENTRY") {
        return {
          success: false,
          message: "Email already exists",
          error: error.message,
        };
      }
      return {
        success: false,
        message: STRINGS.RESPONSES.ERROR_DATABASE,
        error: error.message,
      };
    }
  }

  async insertDefaultData() {
    try {
      const results = { users: [], languages: [] };

      // Insert default users
      for (const user of STRINGS.DEFAULT_USERS) {
        const result = await this.insertUser(
          user.email,
          user.password, // Note: In production, this should be hashed
          user.is_admin
        );
        results.users.push(result);
      }

      // Insert default languages
      const [[{ count: languageCount }]] = await this.connection.execute(
        "SELECT COUNT(*) as count FROM language"
      );
      if (languageCount === 0) {
        for (const language of STRINGS.DEFAULT_LANGUAGES) {
          const [result] = await this.connection.execute(
            "INSERT INTO language (language_name, language_code) VALUES (?, ?)",
            [language.language_name, language.language_code]
          );
          results.languages.push({ success: true, insertId: result.insertId });
        }
      }

      return {
        success: true,
        message: `Inserted default data: ${results.users.length} users, ${results.languages.length} languages`,
        results: results,
      };
    } catch (error) {
      return {
        success: false,
        message: STRINGS.RESPONSES.ERROR_DATABASE,
        error: error.message,
      };
    }
  }

  async getLanguageIdByCode(languageCode) {
    if (!languageCode) return null;

    try {
      const normalizedCode = String(languageCode).trim().toLowerCase();
      const [rows] = await this.connection.execute(
        "SELECT language_id FROM language WHERE LOWER(language_code) = ? LIMIT 1",
        [normalizedCode]
      );

      if (rows.length === 0) {
        console.warn(`Language code not found: ${languageCode}`);
        return null;
      }

      return rows[0].language_id;
    } catch (error) {
      console.error("Get language ID error:", error.message);
      return null;
    }
  }

  // This block of code below was assisted by Claude Sonnet 4 (https://claude.ai/)
  isQuerySafe(query) {
    const upperQuery = query.toUpperCase().trim();

    for (const operation of STRINGS.SECURITY.BLOCKED_OPERATIONS) {
      if (upperQuery.includes(operation)) {
        return false;
      }
    }

    if (!upperQuery.startsWith("SELECT") && !upperQuery.startsWith("INSERT")) {
      return false;
    }

    return true;
  }

  // This block of code below was assisted by Claude Sonnet 4 (https://claude.ai/)
  async executeQuery(query) {
    try {
      if (!this.isQuerySafe(query)) {
        return {
          success: false,
          message: STRINGS.SECURITY.BLOCKED_MESSAGE,
        };
      }

      const [rows] = await this.connection.execute(query);

      return {
        success: true,
        message: STRINGS.RESPONSES.SUCCESS_SELECT,
        data: rows,
      };
    } catch (error) {
      console.error("Query execution error:", error.message);
      return {
        success: false,
        message: STRINGS.RESPONSES.ERROR_DATABASE,
        error: error.message,
      };
    }
  }

  async getAllUsers() {
    try {
      const [rows] = await this.connection.execute(
        "SELECT user_id, email, is_admin, account_status, created_at, last_login FROM user"
      );
      return rows;
    } catch (error) {
      console.error("Get all users error:", error.message);
      return [];
    }
  }

  async getAllUsersWithApiUsage() {
    try {
      const [rows] = await this.connection.execute(
        `SELECT u.user_id, u.email, u.is_admin, u.account_status, u.created_at, u.last_login,
                COALESCE(ua.api_calls_used, 0) as api_calls_used, 
                COALESCE(ua.api_calls_limit, 20) as api_calls_limit
         FROM user u
         LEFT JOIN user_api ua ON u.user_id = ua.user_id`
      );
      return rows;
    } catch (error) {
      console.error("Get all users with API usage error:", error.message);
      return [];
    }
  }

  async findUserByEmail(email) {
    try {
      const [rows] = await this.connection.execute(
        "SELECT user_id, email, password_hash, is_admin, account_status FROM user WHERE email = ?",
        [email]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error("Find user by email error:", error.message);
      return null;
    }
  }

  async getUserById(userId) {
    try {
      const [rows] = await this.connection.execute(
        "SELECT user_id, email, is_admin, account_status FROM user WHERE user_id = ?",
        [userId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error("Get user by ID error:", error.message);
      return null;
    }
  }

  async getUserApiUsage(userId) {
    try {
      const [rows] = await this.connection.execute(
        "SELECT api_calls_used, api_calls_limit FROM user_api WHERE user_id = ?",
        [userId]
      );
      if (rows.length === 0) {
        // If no entry exists, create one with defaults
        await this.connection.execute(
          "INSERT INTO user_api (user_id, api_calls_used, api_calls_limit) VALUES (?, 0, 20)",
          [userId]
        );
        return { api_calls_used: 0, api_calls_limit: 20 };
      }
      return rows[0];
    } catch (error) {
      console.error("Get user API usage error:", error.message);
      return { api_calls_used: 0, api_calls_limit: 20 };
    }
  }

  async verifyPassword(plainPassword, hashedPassword) {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      console.error("Password verification error:", error.message);
      return false;
    }
  }

  async hashPassword(password) {
    try {
      const saltRounds = 10;
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      console.error("Password hashing error:", error.message);
      throw error;
    }
  }

  async incrementApiCalls(userId) {
    try {
      // Ensure user_api entry exists
      const [existing] = await this.connection.execute(
        "SELECT user_id FROM user_api WHERE user_id = ?",
        [userId]
      );

      if (existing.length === 0) {
        // Create entry if it doesn't exist
        await this.connection.execute(
          "INSERT INTO user_api (user_id, api_calls_used, api_calls_limit) VALUES (?, 0, 20)",
          [userId]
        );
      }

      // Increment API calls in user_api table
      await this.connection.execute(
        "UPDATE user_api SET api_calls_used = api_calls_used + 1 WHERE user_id = ?",
        [userId]
      );
      return true;
    } catch (error) {
      console.error("Increment API calls error:", error.message);
      return false;
    }
  }

  async checkApiLimit(userId) {
    try {
      const apiUsage = await this.getUserApiUsage(userId);
      return {
        exceeded: apiUsage.api_calls_used >= apiUsage.api_calls_limit,
        used: apiUsage.api_calls_used,
        limit: apiUsage.api_calls_limit,
      };
    } catch (error) {
      console.error("Check API limit error:", error.message);
      return { exceeded: false, used: 0, limit: 20 };
    }
  }

  async logApiUsage(userId, endpoint, method, languageCode) {
    try {
      const languageId = await this.getLanguageIdByCode(languageCode);
      if (!languageId) {
        console.warn(
          `Skipping API usage log due to missing language ID for code: ${languageCode}`
        );
        return false;
      }

      await this.connection.execute(
        "INSERT INTO api_usage_log (user_id, language_id, endpoint, method) VALUES (?, ?, ?, ?)",
        [userId, languageId, endpoint, method]
      );
      
      console.log(`✓ Logged API call: ${method} ${endpoint} for user ${userId}`);
      return true;
    } catch (error) {
      console.error("Log API usage error:", error.message);
      return false;
    }
  }

  async updateLastLogin(userId) {
    try {
      await this.connection.execute(
        "UPDATE user SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?",
        [userId]
      );
      return true;
    } catch (error) {
      console.error("Update last login error:", error.message);
      return false;
    }
  }

  // Database role switching methods
  async switchToAdminRole() {
    try {
      await this.connection.execute("SET ROLE 'audio_book_admin'");
      this.currentRole = 'admin';
      console.log('Switched to admin role');
    } catch (error) {
      console.error('Error switching to admin role:', error.message);
      throw error;
    }
  }

  async switchToUserRole() {
    try {
      await this.connection.execute("SET ROLE 'audio_book_user'");
      this.currentRole = 'user';
      console.log('Switched to user role');
    } catch (error) {
      console.error('Error switching to user role:', error.message);
      throw error;
    }
  }

  // Admin operation methods
  async deleteUser(userId) {
    try {
      const [result] = await this.connection.execute(
        "DELETE FROM user WHERE user_id = ?",
        [userId]
      );
      return {
        success: true,
        message: "User deleted successfully",
        affectedRows: result.affectedRows
      };
    } catch (error) {
      console.error('Delete user error:', error.message);
      return {
        success: false,
        message: "Failed to delete user",
        error: error.message
      };
    }
  }

  async resetUserApiUsage(userId) {
    try {
      const [result] = await this.connection.execute(
        "UPDATE user_api SET api_calls_used = 0 WHERE user_id = ?",
        [userId]
      );
      return {
        success: true,
        message: "API usage reset successfully",
        affectedRows: result.affectedRows
      };
    } catch (error) {
      console.error('Reset API usage error:', error.message);
      return {
        success: false,
        message: "Failed to reset API usage",
        error: error.message
      };
    }
  }

  async getEndpointStatistics() {
    try {
      await this.switchToAdminRole();
      
      const [rows] = await this.connection.execute(`
        SELECT 
          method,
          endpoint,
          COUNT(*) as request_count,
          CONVERT_TZ(MAX(request_timestamp), '+00:00', '-08:00') as last_called_pst
        FROM api_usage_log 
        GROUP BY method, endpoint 
        ORDER BY request_count DESC
      `);
      
      // the `formattedRows` variable is generated by Cluaude Sonnet 4 (https://claude.ai/)
      const formattedRows = rows.map(row => ({
        ...row,
        last_called_formatted: row.last_called_pst ? 
          new Date(row.last_called_pst).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          }) + ' PST' : 'Never'
      }));
      
      return formattedRows;
    } catch (error) {
      console.error("Get endpoint statistics error:", error.message);
      return [];
    }
  }

  async close() {
    if (this.connection) {
      await this.connection.end();
    }
  }
}

export default Database;
