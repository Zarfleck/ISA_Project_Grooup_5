/*

Claude Sonnet 4 (https://claude.ai/) was used to generate the following code solutions in this assignment:
  
  1. Table Creation Logic - The automated table creation with Engine=InnoDB specification and IF NOT EXISTS condition for proper database schema management.
  
  2. The isQuerySafe(), insertPatient(), executeQuery() method for blocking dangerous SQL operations (UPDATE, DELETE, DROP) while allowing only SELECT and INSERT queries.

  3. Database Class Structure - The object-oriented approach using ES6 classes for organizing database operations and connection management.

*/

const mysql = require('mysql2/promise');
const STRINGS = require('./userTable');

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
      await this.connection.execute(STRINGS.CREATE_TABLE_QUERY);
      console.log(STRINGS.SERVER.TABLE_CREATED);
      await this.connection.execute(STRINGS.CREATE_USERS_TABLE_QUERY);
      console.log(STRINGS.SERVER.USERS_TABLE_CREATED);
    } catch (error) {
      console.error('Table creation error:', error.message);
      throw error;
    }
  }

  // This block of code below was assisted by Claude Sonnet 4 (https://claude.ai/)
  async insertPatient(name, dateOfBirth) {
    try {
      const [result] = await this.connection.execute(
        STRINGS.INSERT_PATIENT_QUERY,
        [name, dateOfBirth]
      );
      return {
        success: true,
        message: STRINGS.RESPONSES.SUCCESS_INSERT,
        insertId: result.insertId
      };
    } catch (error) {
      console.error('Insert error:', error.message);
      return {
        success: false,
        message: STRINGS.RESPONSES.ERROR_DATABASE,
        error: error.message
      };
    }
  }

  async insertDefaultPatients() {
    try {
      const results = [];
      for (const patient of STRINGS.DEFAULT_PATIENTS) {
        const result = await this.insertPatient(patient.name, patient.dateOfBirth);
        results.push(result);
      }
      return {
        success: true,
        message: `Inserted ${results.length} patients`,
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
    
    // Block dangerous operations
    for (const operation of STRINGS.SECURITY.BLOCKED_OPERATIONS) {
      if (upperQuery.includes(operation)) {
        return false;
      }
    }
    
    // Only allow SELECT and INSERT statements
    if (!upperQuery.startsWith('SELECT') && !upperQuery.startsWith('INSERT')) {
      return false;
    }
    
    // Block UNION-based SQL injection attacks
    if (upperQuery.includes('UNION')) {
      return false;
    }
    
    // Block multiple statements (allow single semicolon at end)
    const statements = query.split(';').filter(s => s.trim().length > 0);
    if (statements.length > 1) {
      return false;
    }
    
    // Block comment-based SQL injection
    if (query.includes('--') || query.includes('/*') || query.includes('*/')) {
      return false;
    }
    
    // Block subqueries that could be used for SQL injection
    if (upperQuery.includes('(SELECT') || upperQuery.includes('(INSERT')) {
      return false;
    }
    
    // Block functions that could be used maliciously
    const dangerousFunctions = ['LOAD_FILE', 'INTO OUTFILE', 'INTO DUMPFILE', 'BENCHMARK', 'SLEEP'];
    for (const func of dangerousFunctions) {
      if (upperQuery.includes(func)) {
        return false;
      }
    }
    
    return true;
  }

  // This block of code below was assisted by Claude Sonnet 4 (https://claude.ai/)
  async executeQuery(query) {
    try {
      // Validate and sanitize query
      if (!query || typeof query !== 'string') {
        return {
          success: false,
          message: STRINGS.RESPONSES.ERROR_INVALID_QUERY
        };
      }
      
      // Trim and validate query length to prevent DoS
      const trimmedQuery = query.trim();
      if (trimmedQuery.length > 5000) {
        return {
          success: false,
          message: 'Query too long. Maximum length is 5000 characters.'
        };
      }
      
      if (!this.isQuerySafe(trimmedQuery)) {
        return {
          success: false,
          message: STRINGS.SECURITY.BLOCKED_MESSAGE
        };
      }

      // Execute query - WARNING: mysql2's execute() with a single string parameter
      // executes the query directly (NOT as a prepared statement with parameters).
      // The isQuerySafe() validation above provides defense-in-depth by blocking
      // dangerous patterns, but this is still a potential security risk.
      // 
      // For production, consider:
      // 1. Using a query builder library (e.g., Knex.js)
      // 2. Whitelisting specific query patterns instead of allowing free-form SQL
      // 3. Using a read-only database user for this endpoint
      // 4. Implementing query parsing/validation with a SQL parser library
      const [rows] = await this.connection.execute(trimmedQuery);
      
      return {
        success: true,
        message: STRINGS.RESPONSES.SUCCESS_SELECT,
        data: rows
      };
    } catch (error) {
      console.error('Query execution error:', error.message);
      // Don't expose detailed database errors to clients
      return {
        success: false,
        message: STRINGS.RESPONSES.ERROR_DATABASE,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  async createUser(firstName, email, hashedPassword) {
    try {
      const [result] = await this.connection.execute(
        STRINGS.INSERT_USER_QUERY,
        [firstName, email, hashedPassword]
      );
      return {
        success: true,
        userId: result.insertId
      };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return {
          success: false,
          message: STRINGS.RESPONSES.ERROR_EMAIL_EXISTS
        };
      }
      console.error('Create user error:', error.message);
      return {
        success: false,
        message: STRINGS.RESPONSES.ERROR_DATABASE,
        error: error.message
      };
    }
  }

  async findUserByEmail(email) {
    try {
      const [rows] = await this.connection.execute(
        STRINGS.FIND_USER_BY_EMAIL_QUERY,
        [email]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Find user error:', error.message);
      return null;
    }
  }

  async findUserById(id) {
    try {
      const [rows] = await this.connection.execute(
        STRINGS.FIND_USER_BY_ID_QUERY,
        [id]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Find user by ID error:', error.message);
      return null;
    }
  }

  async incrementApiCalls(userId) {
    try {
      await this.connection.execute(
        STRINGS.UPDATE_API_CALLS_QUERY,
        [userId]
      );
      return true;
    } catch (error) {
      console.error('Increment API calls error:', error.message);
      return false;
    }
  }

  async close() {
    if (this.connection) {
      await this.connection.end();
    }
  }
}

module.exports = Database;