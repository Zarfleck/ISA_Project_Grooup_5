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
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        is_admin BOOLEAN DEFAULT FALSE,
        api_calls_used INT DEFAULT 0,
        api_calls_limit INT DEFAULT 20,
        account_status ENUM('active', 'suspended') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL,
        INDEX idx_email (email),
        INDEX idx_account_status (account_status)
      ) ENGINE=InnoDB
    `,
    
    VOICE_TABLE: `
      CREATE TABLE IF NOT EXISTS voice (
        voice_id INT AUTO_INCREMENT PRIMARY KEY,
        voice_name VARCHAR(100) NOT NULL,
        voice_code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_voice_code (voice_code),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB
    `,
    
    LANGUAGE_TABLE: `
      CREATE TABLE IF NOT EXISTS language (
        language_id INT AUTO_INCREMENT PRIMARY KEY,
        language_name VARCHAR(100) NOT NULL,
        language_code VARCHAR(10) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_language_code (language_code),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB
    `,
    
    AUDIO_GENERATION_TABLE: `
      CREATE TABLE IF NOT EXISTS audio_generation (
        generation_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        text_content TEXT NOT NULL,
        voice_id INT NOT NULL,
        language_id INT NOT NULL,
        audio_file_path VARCHAR(500),
        generation_status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
        error_message TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_generation_status (generation_status),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE,
        FOREIGN KEY (voice_id) REFERENCES voice(voice_id),
        FOREIGN KEY (language_id) REFERENCES language(language_id)
      ) ENGINE=InnoDB
    `,
    
    USER_PREFERENCE_TABLE: `
      CREATE TABLE IF NOT EXISTS user_preference (
        preference_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNIQUE NOT NULL,
        default_voice_id INT,
        default_language_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE,
        FOREIGN KEY (default_voice_id) REFERENCES voice(voice_id),
        FOREIGN KEY (default_language_id) REFERENCES language(language_id)
      ) ENGINE=InnoDB
    `,
    
    API_USAGE_LOG_TABLE: `
      CREATE TABLE IF NOT EXISTS api_usage_log (
        log_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        endpoint VARCHAR(255) NOT NULL,
        method VARCHAR(10) NOT NULL,
        request_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_request_timestamp (request_timestamp),
        INDEX idx_endpoint (endpoint),
        FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `
  },
  
  // Default test data
  DEFAULT_USERS: [
    { email: 'john@john.com', password: '123', is_admin: false, first_name: 'John', last_name: 'Doe' },
    { email: 'admin@admin.com', password: '111', is_admin: true, first_name: 'Admin', last_name: 'User' }
  ],
  
  DEFAULT_VOICES: [
    { voice_name: 'Natural Female', voice_code: 'female_natural', description: 'Clear and natural female voice' },
    { voice_name: 'Professional Male', voice_code: 'male_professional', description: 'Professional male voice for business content' },
    { voice_name: 'Neutral Voice', voice_code: 'neutral_standard', description: 'Gender-neutral voice option' }
  ],
  
  DEFAULT_LANGUAGES: [
    { language_name: 'English', language_code: 'en' },
    { language_name: 'Spanish', language_code: 'es' },
    { language_name: 'French', language_code: 'fr' }
  ],
  
  // HTTP Response Messages
  RESPONSES: {
    SUCCESS_INSERT: 'Data inserted successfully',
    SUCCESS_SELECT: 'Query executed successfully',
    SUCCESS_AUDIO_GENERATION: 'Audio generation completed successfully',
    ERROR_INVALID_QUERY: 'Invalid or dangerous query detected',
    ERROR_DATABASE: 'Database error occurred',
    ERROR_METHOD: 'Method not allowed',
    ERROR_MISSING_QUERY: 'SQL query is required',
    ERROR_SERVER: 'Internal server error',
    ERROR_AUTHENTICATION: 'Authentication failed',
    ERROR_API_LIMIT: 'API call limit exceeded'
  },
  
  // Security Messages
  SECURITY: {
    BLOCKED_OPERATIONS: ['UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE'],
    BLOCKED_MESSAGE: 'Operation not allowed for security reasons'
  },
  
  // Server Messages
  SERVER: {
    STARTUP: 'Audio Book Server running on port',
    DB_CONNECTED: 'Connected to MySQL database',
    DB_ERROR: 'Database connection failed',
    TABLES_CREATED: 'Audio Book database tables ready'
  }
};

module.exports = STRINGS;