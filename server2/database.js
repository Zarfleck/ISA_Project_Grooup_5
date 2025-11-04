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
      await this.connection.execute(STRINGS.CREATE_TABLES_QUERIES.VOICE_TABLE);
      await this.connection.execute(
        STRINGS.CREATE_TABLES_QUERIES.LANGUAGE_TABLE
      );
      await this.connection.execute(
        STRINGS.CREATE_TABLES_QUERIES.AUDIO_GENERATION_TABLE
      );
      await this.connection.execute(
        STRINGS.CREATE_TABLES_QUERIES.USER_PREFERENCE_TABLE
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
    firstName = null,
    lastName = null,
    isAdmin = false
  ) {
    try {
      const [result] = await this.connection.execute(
        "INSERT INTO user (email, password_hash, first_name, last_name, is_admin) VALUES (?, ?, ?, ?, ?)",
        [email, passwordHash, firstName, lastName, isAdmin]
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
      const results = { users: [], voices: [], languages: [] };

      // Insert default users
      for (const user of STRINGS.DEFAULT_USERS) {
        const result = await this.insertUser(
          user.email,
          user.password, // Note: In production, this should be hashed
          user.first_name,
          user.last_name,
          user.is_admin
        );
        results.users.push(result);
      }

      // Insert default voices
      for (const voice of STRINGS.DEFAULT_VOICES) {
        const [result] = await this.connection.execute(
          "INSERT INTO voice (voice_name, voice_code, description) VALUES (?, ?, ?)",
          [voice.voice_name, voice.voice_code, voice.description]
        );
        results.voices.push({ success: true, insertId: result.insertId });
      }

      // Insert default languages
      for (const language of STRINGS.DEFAULT_LANGUAGES) {
        const [result] = await this.connection.execute(
          "INSERT INTO language (language_name, language_code) VALUES (?, ?)",
          [language.language_name, language.language_code]
        );
        results.languages.push({ success: true, insertId: result.insertId });
      }

      return {
        success: true,
        message: `Inserted default data: ${results.users.length} users, ${results.voices.length} voices, ${results.languages.length} languages`,
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
        "SELECT user_id, email, first_name, last_name, is_admin, api_calls_used, api_calls_limit, account_status, created_at, last_login FROM user"
      );
      return rows;
    } catch (error) {
      console.error("Get all users error:", error.message);
      return [];
    }
  }

  async findUserByEmail(email) {
    try {
      const [rows] = await this.connection.execute(
        "SELECT user_id, email, password_hash, first_name, last_name, is_admin, api_calls_used, api_calls_limit, account_status FROM user WHERE email = ?",
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
        "SELECT user_id, email, first_name, last_name, is_admin, api_calls_used, api_calls_limit, account_status FROM user WHERE user_id = ?",
        [userId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error("Get user by ID error:", error.message);
      return null;
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
      await this.connection.execute(
        "UPDATE user SET api_calls_used = api_calls_used + 1 WHERE user_id = ?",
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
      const [rows] = await this.connection.execute(
        "SELECT api_calls_used, api_calls_limit FROM user WHERE user_id = ?",
        [userId]
      );
      if (rows.length === 0) return { exceeded: false, used: 0, limit: 0 };

      const { api_calls_used, api_calls_limit } = rows[0];
      return {
        exceeded: api_calls_used >= api_calls_limit,
        used: api_calls_used,
        limit: api_calls_limit,
      };
    } catch (error) {
      console.error("Check API limit error:", error.message);
      return { exceeded: false, used: 0, limit: 0 };
    }
  }

  async logApiUsage(userId, endpoint, method) {
    try {
      await this.connection.execute(
        "INSERT INTO api_usage_log (user_id, endpoint, method) VALUES (?, ?, ?)",
        [userId, endpoint, method]
      );
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

  async close() {
    if (this.connection) {
      await this.connection.end();
    }
  }
}

export default Database;
