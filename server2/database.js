/*

Claude Sonnet 4 (https://claude.ai/) was used to generate the following code solutions in this assignment:
  
  1. Audio Book Database Schema - Complete table creation logic with proper relationships for users, voices, languages, audio generations, and user preferences.
  
  2. Security Methods - The isQuerySafe() and executeQuery() methods for blocking dangerous SQL operations while allowing safe SELECT and INSERT queries.

  3. Database Class Structure - Object-oriented approach using ES6 classes for organizing Audio Book database operations and connection management.

  4. Default Data Management - Methods for inserting test users, voices, and languages required for the Audio Book application.

*/

const mysql = require('mysql2/promise');
const STRINGS = require('./lang/messages/en/user');

class Database {
  constructor() {
    this.connection = null;
  }

  async connect() {
    try {
      console.log('DB Config:', {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        database: process.env.DB_NAME
      });
      
      this.connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
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
      await this.connection.execute(STRINGS.CREATE_TABLES_QUERIES.LANGUAGE_TABLE);
      await this.connection.execute(STRINGS.CREATE_TABLES_QUERIES.AUDIO_GENERATION_TABLE);
      await this.connection.execute(STRINGS.CREATE_TABLES_QUERIES.USER_PREFERENCE_TABLE);
      await this.connection.execute(STRINGS.CREATE_TABLES_QUERIES.API_USAGE_LOG_TABLE);
      
      console.log(STRINGS.SERVER.TABLES_CREATED);
    } catch (error) {
      console.error('Table creation error:', error.message);
      throw error;
    }
  }

  // This block of code below was assisted by Claude Sonnet 4 (https://claude.ai/)
  async insertUser(email, passwordHash, firstName, lastName, isAdmin = false) {
    try {
      const [result] = await this.connection.execute(
        'INSERT INTO user (email, password_hash, first_name, last_name, is_admin) VALUES (?, ?, ?, ?, ?)',
        [email, passwordHash, firstName, lastName, isAdmin]
      );
      return {
        success: true,
        message: STRINGS.RESPONSES.SUCCESS_INSERT,
        insertId: result.insertId
      };
    } catch (error) {
      console.error('Insert user error:', error.message);
      return {
        success: false,
        message: STRINGS.RESPONSES.ERROR_DATABASE,
        error: error.message
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
          'INSERT INTO voice (voice_name, voice_code, description) VALUES (?, ?, ?)',
          [voice.voice_name, voice.voice_code, voice.description]
        );
        results.voices.push({ success: true, insertId: result.insertId });
      }
      
      // Insert default languages
      for (const language of STRINGS.DEFAULT_LANGUAGES) {
        const [result] = await this.connection.execute(
          'INSERT INTO language (language_name, language_code) VALUES (?, ?)',
          [language.language_name, language.language_code]
        );
        results.languages.push({ success: true, insertId: result.insertId });
      }
      
      return {
        success: true,
        message: `Inserted default data: ${results.users.length} users, ${results.voices.length} voices, ${results.languages.length} languages`,
        results: results
      };
    } catch (error) {
      return {
        success: false,
        message: STRINGS.RESPONSES.ERROR_DATABASE,
        error: error.message
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
    
    if (!upperQuery.startsWith('SELECT') && !upperQuery.startsWith('INSERT')) {
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
          message: STRINGS.SECURITY.BLOCKED_MESSAGE
        };
      }

      const [rows] = await this.connection.execute(query);
      
      return {
        success: true,
        message: STRINGS.RESPONSES.SUCCESS_SELECT,
        data: rows
      };
    } catch (error) {
      console.error('Query execution error:', error.message);
      return {
        success: false,
        message: STRINGS.RESPONSES.ERROR_DATABASE,
        error: error.message
      };
    }
  }

  async close() {
    if (this.connection) {
      await this.connection.end();
    }
  }
}

module.exports = Database;