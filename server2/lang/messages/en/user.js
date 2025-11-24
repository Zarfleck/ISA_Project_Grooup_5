/*

Claude Sonnet 4 (https://claude.ai/) was used to generate the following code solutions in this assignment:

  Database Schema Design - The complete Audio Book database schema with proper relationships and constraints for user management, audio generation, and TTS functionality.

*/

const STRINGS = {
  // Database Creation Queries
  CREATE_TABLES_QUERIES: {
    USER_TABLE: `
      CREATE TABLE IF NOT EXISTS user (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        account_status ENUM('active', 'suspended') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL,
        INDEX idx_email (email),
        INDEX idx_account_status (account_status)
      ) ENGINE=InnoDB;
    `,

    LANGUAGE_TABLE: `
      CREATE TABLE IF NOT EXISTS language (
        language_id INT AUTO_INCREMENT PRIMARY KEY,
        language_name VARCHAR(100) NOT NULL,
        language_code VARCHAR(10) UNIQUE NOT NULL,
        INDEX idx_language_code (language_code)
      ) ENGINE=InnoDB;
    `,

    USER_API_TABLE: `
      CREATE TABLE IF NOT EXISTS user_api (
        user_id INT PRIMARY KEY,
        api_calls_used INT DEFAULT 0,
        api_calls_limit INT DEFAULT 20,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_user_api_user
          FOREIGN KEY (user_id) REFERENCES user(user_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      ) ENGINE=InnoDB
    `,

    LANGUAGE_TABLE: `
      CREATE TABLE IF NOT EXISTS language (
        language_id INT AUTO_INCREMENT PRIMARY KEY,
        language_name VARCHAR(100) NOT NULL,
        language_code VARCHAR(10) UNIQUE NOT NULL,
        
        INDEX idx_language_code (language_code)
      ) ENGINE=InnoDB
    `,

    API_USAGE_LOG_TABLE: `
      CREATE TABLE IF NOT EXISTS api_usage_log (
        log_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        language_id INT NOT NULL,
        endpoint VARCHAR(255) NOT NULL,
        method VARCHAR(10) NOT NULL,
        request_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        INDEX idx_user_id (user_id),
        INDEX idx_request_timestamp (request_timestamp),
        INDEX idx_endpoint (endpoint),

        CONSTRAINT fk_api_log_user
          FOREIGN KEY (user_id) REFERENCES user(user_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,

        CONSTRAINT fk_api_log_language
          FOREIGN KEY (language_id) REFERENCES language(language_id)
          ON DELETE SET NULL
          ON UPDATE CASCADE
      ) ENGINE=InnoDB
    `,
  },

  // Default test data
  DEFAULT_USERS: [
    {
      email: "john@john.com",
      password: "123",
      is_admin: false,
    },
    {
      email: "admin@admin.com",
      password: "111",
      is_admin: true,
    },
  ],

  DEFAULT_LANGUAGES: [
    { language_name: "English", language_code: "en" },
    { language_name: "Spanish", language_code: "es" },
    { language_name: "French", language_code: "fr" },
    { language_name: "German", language_code: "de" },
    { language_name: "Italian", language_code: "it" },
    { language_name: "Portuguese", language_code: "pt" },
    { language_name: "Polish", language_code: "pl" },
    { language_name: "Turkish", language_code: "tr" },
    { language_name: "Russian", language_code: "ru" },
    { language_name: "Dutch", language_code: "nl" },
    { language_name: "Czech", language_code: "cs" },
    { language_name: "Arabic", language_code: "ar" },
    { language_name: "Chinese", language_code: "zh-cn" },
    { language_name: "Japanese", language_code: "ja" },
    { language_name: "Hungarian", language_code: "hu" },
    { language_name: "Korean", language_code: "ko" },
    { language_name: "Hindi", language_code: "hi" },
  ],

  // HTTP Response Messages
  RESPONSES: {
    SUCCESS_INSERT: "Data inserted successfully",
    SUCCESS_SELECT: "Query executed successfully",
    SUCCESS_AUDIO_GENERATION: "Audio generation completed successfully",
    ERROR_INVALID_QUERY: "Invalid or dangerous query detected",
    ERROR_DATABASE: "Database error occurred",
    ERROR_METHOD: "Method not allowed",
    ERROR_MISSING_QUERY: "SQL query is required",
    ERROR_SERVER: "Internal server error",
    ERROR_AUTHENTICATION: "Authentication failed",
    ERROR_API_LIMIT: "API call limit exceeded",
    NOT_FOUND: "Not found",
  },

  // Security Messages
  SECURITY: {
    BLOCKED_OPERATIONS: [
      "UPDATE",
      "DELETE",
      "DROP",
      "ALTER",
      "TRUNCATE",
      "CREATE",
      "GRANT",
      "REVOKE",
    ],
    BLOCKED_MESSAGE: "Operation not allowed for security reasons",
  },

  // Server Messages
  SERVER: {
    STARTUP: "Audio Book Server running on port",
    DB_CONNECTED: "Connected to MySQL database",
    DB_ERROR: "Database connection failed",
    TABLES_CREATED: "Audio Book database tables ready",
  },

  SIGNUP: {
    EMAIL_EXISTS: "Email is already registered",
    FIELDS_REQUIRED: "Email and password are required",
    USER_REGISTERED: "User registered successfully",
  },

  LOGIN: {
    FIELDS_REQUIRED: "Email and password are required",
    INVALID_CREDENTIALS: "Invalid email or password",
    LOGIN_SUCCESS: "Login successful",
  },

  LOGOUT: {
    SUCCESS: "Logged out successfully",
  },

  ADMIN: {
    INVALID_USER_ID: "Invalid user ID",
    CANNOT_DELETE_SELF: "Cannot delete your own account",
    USER_NOT_FOUND: "User not found",
    DELETE_SUCCESS: "User deleted successfully",
    DELETE_FAILURE: "Failed to delete user",
  },

  API_USAGE: {
    LIMIT_INCREASED: "API call limit increased",
    RESET_SUCCESS: "API usage reset successfully",
    RESET_FAILURE: "Failed to reset API usage",
  },

  TTS: {
    TEXT_REQUIRED: "Text is required to synthesize speech",
    LANGUAGE_REQUIRED: "Language is required to synthesize speech",
    SERVICE_ERROR: "Text-to-speech service returned an error",
    PARSE_ERROR_PREFIX: "Failed to parse AI response:",
  },

  LOGS: {
    AUTH_ERROR_PREFIX: "Authentication error:",
    API_LOGGING_ERROR_PREFIX: "API logging error:",
    ADMIN_AUTH_ERROR_PREFIX: "Admin auth middleware error:",
    USER_AUTH_ERROR_PREFIX: "User auth middleware error:",
    DELETE_USER_ERROR_PREFIX: "Delete user endpoint error:",
    RESET_USAGE_ERROR_PREFIX: "Reset API usage endpoint error:",
    TTS_PROXY_ERROR_PREFIX: "TTS proxy error:",
    DB_CONNECT_FAILURE: "Failed to connect to database. Exiting...",
    SERVER_SHUTDOWN: "Shutting down server...",
    ADMIN_DASHBOARD_ERROR_PREFIX: "Admin dashboard error:",
  },

  DATABASE_MESSAGES: {
    DB_CONFIG_PREFIX: "DB Config:",
    TABLE_CREATION_ERROR: "Table creation error:",
    INSERT_USER_ERROR: "Insert user error:",
    DUPLICATE_EMAIL: "Email already exists",
    DEFAULT_DATA_INSERTED: (userCount, languageCount) =>
      `Inserted default data: ${userCount} users, ${languageCount} languages`,
    LANGUAGE_NOT_FOUND: (code) => `Language code not found: ${code}`,
    QUERY_EXECUTION_ERROR: "Query execution error:",
    GET_LANGUAGE_ID_ERROR: "Get language ID error:",
    GET_ALL_USERS_ERROR: "Get all users error:",
    GET_ALL_USERS_WITH_USAGE_ERROR: "Get all users with API usage error:",
    FIND_USER_BY_EMAIL_ERROR: "Find user by email error:",
    GET_USER_BY_ID_ERROR: "Get user by ID error:",
    GET_USER_API_USAGE_ERROR: "Get user API usage error:",
    PASSWORD_VERIFICATION_ERROR: "Password verification error:",
    PASSWORD_HASHING_ERROR: "Password hashing error:",
    INCREMENT_API_CALLS_ERROR: "Increment API calls error:",
    CHECK_API_LIMIT_ERROR: "Check API limit error:",
    LOG_API_USAGE_SKIP: (code) =>
      `Skipping API usage log due to missing language ID for code: ${code}`,
    LOG_API_USAGE_ERROR: "Log API usage error:",
    LOG_API_USAGE_SUCCESS: (method, endpoint, userId) =>
      `✓ Logged API call: ${method} ${endpoint} for user ${userId}`,
    UPDATE_LAST_LOGIN_ERROR: "Update last login error:",
    SWITCH_TO_ADMIN: "Switched to admin role",
    SWITCH_TO_USER: "Switched to user role",
    SWITCH_TO_ADMIN_ERROR: "Error switching to admin role:",
    SWITCH_TO_USER_ERROR: "Error switching to user role:",
    RESET_API_USAGE_ERROR: "Reset API usage error:",
    GET_ENDPOINT_STATS_ERROR: "Get endpoint statistics error:",
    DELETE_USER_ERROR: "Delete user error:",
  },
};

export default STRINGS;
