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
      ) ENGINE=InnoDB
    `,

    USER_API_TABLE: `
      CREATE TABLE IF NOT EXISTS user_api (
        user_id INT PRIMARY KEY,
        api_calls_used INT DEFAULT 0,
        api_calls_limit INT DEFAULT 20,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
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
        FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE,
        FOREIGN KEY (language_id) REFERENCES language(language_id) ON DELETE CASCADE
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
};

export default STRINGS;
