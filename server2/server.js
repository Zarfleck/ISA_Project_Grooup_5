/*
Claude Sonnet 4 (https://claude.ai/) was used to generate the following code solutions in this assignment:

    1. API Route Handling - The handleInsertDefault(), handleCustomQuery(), and handleGetQuery() functions for processing different types of database operations.

    2. Error Handling - Comprehensive try-catch blocks with proper HTTP status codes and JSON error responses.

    3. Database Integration - The server startup sequence with database connection validation and graceful shutdown handling.

*/

// Load environment variables (always try .env file, then use platform env vars)
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  console.log('Loaded .env file successfully');
} catch (error) {
  console.log('Dotenv not available, using platform environment variables only');
}
const http = require('http');
const Database = require('./database');
const STRINGS = require('./lang/messages/en/user');
const { generateToken, verifyToken, extractTokenFromCookie, extractTokenFromHeader } = require('./auth');

const db = new Database();

function setCORSHeaders(response, request) {
  // When credentials are included, we cannot use wildcard '*'
  // Instead, we need to reflect the request's origin
  const origin = request.headers.origin;
  
  // For requests with credentials, we must use the specific origin, not '*'
  if (origin) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    // Only use '*' if no origin (shouldn't happen with credentials, but safe fallback)
    response.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Content-Type', 'application/json');
}

function setCookie(response, name, value, options = {}) {
  const defaultOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/'
  };
  
  const cookieOptions = { ...defaultOptions, ...options };
  let cookieString = `${name}=${encodeURIComponent(value)}`;
  
  if (cookieOptions.maxAge) {
    cookieString += `; Max-Age=${cookieOptions.maxAge}`;
  }
  if (cookieOptions.path) {
    cookieString += `; Path=${cookieOptions.path}`;
  }
  if (cookieOptions.httpOnly) {
    cookieString += '; HttpOnly';
  }
  if (cookieOptions.secure) {
    cookieString += '; Secure';
  }
  if (cookieOptions.sameSite) {
    cookieString += `; SameSite=${cookieOptions.sameSite}`;
  }
  
  response.setHeader('Set-Cookie', cookieString);
}

async function authenticateRequest(request) {
  const cookieHeader = request.headers.cookie;
  const authHeader = request.headers.authorization;
  
  // Try to get token from cookie first, then from Authorization header
  let token = extractTokenFromCookie(cookieHeader);
  if (!token) {
    token = extractTokenFromHeader(authHeader);
  }
  
  if (!token) {
    return null;
  }
  
  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) {
    return null;
  }
  
  const user = await db.getUserById(decoded.userId);
  return user;
}

function parsePostData(request) { // Declares function that takes HTTP request object as parameter
  return new Promise((resolve, reject) => { // Returns Promise for async operation with resolve/reject callbacks
    let body = ''; // Initialize empty string to accumulate all data chunks
    request.on('data', chunk => { // Listen for 'data' events when chunks of data arrive from client
      body += chunk.toString(); // Convert Buffer chunk to string and append to body variable
    });
    request.on('end', () => { // Listen for 'end' event when all data has been received
      try { // Start try-catch block to handle potential JSON parsing errors
        const data = JSON.parse(body); // Parse the complete body string as JSON
        resolve(data); // If parsing succeeds, fulfill Promise with parsed data
      } catch (error) { // If JSON parsing fails, catch the error
        reject(error); // Reject Promise with the parsing error
      }
    });
    request.on('error', error => { // Listen for any errors during request processing
      reject(error); // If request error occurs, reject Promise with that error
    });
  });
}

// Authentication endpoints
async function handleSignup(request, response) {
  try {
    const data = await parsePostData(request);
    
    if (!data.email || !data.password) {
      response.writeHead(400);
      response.end(JSON.stringify({
        success: false,
        message: 'Email and password are required'
      }));
      return;
    }
    
    // Check if user already exists
    const existingUser = await db.findUserByEmail(data.email);
    if (existingUser) {
      response.writeHead(400);
      response.end(JSON.stringify({
        success: false,
        message: 'Email already exists'
      }));
      return;
    }
    
    // Hash password and create user
    const passwordHash = await db.hashPassword(data.password);
    const result = await db.insertUser(data.email, passwordHash, null, data.lastName || null);
    
    if (!result.success) {
      response.writeHead(400);
      response.end(JSON.stringify(result));
      return;
    }
    
    // Generate token
    const token = generateToken(result.userId, data.email);
    
    // Set httpOnly cookie
    setCookie(response, 'token', token);
    
    response.writeHead(200);
    response.end(JSON.stringify({
      success: true,
      message: 'User registered successfully',
      token: token,
      userId: result.userId
    }));
  } catch (error) {
    response.writeHead(500);
    response.end(JSON.stringify({
      success: false,
      message: STRINGS.RESPONSES.ERROR_SERVER,
      error: error.message
    }));
  }
}

async function handleLogin(request, response) {
  try {
    const data = await parsePostData(request);
    
    if (!data.email || !data.password) {
      response.writeHead(400);
      response.end(JSON.stringify({
        success: false,
        message: 'Email and password are required'
      }));
      return;
    }
    
    // Find user
    const user = await db.findUserByEmail(data.email);
    if (!user) {
      response.writeHead(401);
      response.end(JSON.stringify({
        success: false,
        message: STRINGS.RESPONSES.ERROR_AUTHENTICATION
      }));
      return;
    }
    
    // Verify password
    const passwordValid = await db.verifyPassword(data.password, user.password_hash);
    if (!passwordValid) {
      response.writeHead(401);
      response.end(JSON.stringify({
        success: false,
        message: STRINGS.RESPONSES.ERROR_AUTHENTICATION
      }));
      return;
    }
    
    // Update last login
    await db.updateLastLogin(user.user_id);
    
    // Generate token
    const token = generateToken(user.user_id, user.email);
    
    // Set httpOnly cookie
    setCookie(response, 'token', token);
    
    response.writeHead(200);
    response.end(JSON.stringify({
      success: true,
      message: 'Login successful',
      token: token,
      user: {
        userId: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        apiCallsUsed: user.api_calls_used,
        apiCallsLimit: user.api_calls_limit
      }
    }));
  } catch (error) {
    response.writeHead(500);
    response.end(JSON.stringify({
      success: false,
      message: STRINGS.RESPONSES.ERROR_SERVER,
      error: error.message
    }));
  }
}

async function handleCurrentUser(request, response) {
  try {
    const user = await authenticateRequest(request);
    
    if (!user) {
      response.writeHead(401);
      response.end(JSON.stringify({
        success: false,
        message: STRINGS.RESPONSES.ERROR_AUTHENTICATION
      }));
      return;
    }
    
    // Check API limit
    const apiLimit = await db.checkApiLimit(user.user_id);
    
    response.writeHead(200);
    response.end(JSON.stringify({
      success: true,
      user: {
        userId: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        apiCallsUsed: user.api_calls_used,
        apiCallsLimit: user.api_calls_limit,
        apiLimitExceeded: apiLimit.exceeded
      }
    }));
  } catch (error) {
    response.writeHead(500);
    response.end(JSON.stringify({
      success: false,
      message: STRINGS.RESPONSES.ERROR_SERVER,
      error: error.message
    }));
  }
}

// This block of code below was assisted by Claude Sonnet 4 (https://claude.ai/)
async function handleInsertDefault(response, userId) { // Async function to handle inserting default patients, takes HTTP response object
  try { // Start try-catch block to handle any database errors
    const result = await db.insertDefaultData(); // Call database method to insert default data, wait for completion
    
    // Track API usage
    if (userId) {
      await db.incrementApiCalls(userId);
      await db.logApiUsage(userId, '/api/v1/patients/default', 'POST');
      const apiLimit = await db.checkApiLimit(userId);
      result.apiLimitExceeded = apiLimit.exceeded;
    }
    
    response.writeHead(200); // Set HTTP status code to 200 (OK) indicating success
    response.end(JSON.stringify(result)); // Send the result back to client as JSON string and end response
  } catch (error) { // If any error occurs during database operation
    response.writeHead(500); // Set HTTP status code to 500 (Internal Server Error)
    response.end(JSON.stringify({ // Send error response as JSON
      success: false, // Indicate operation failed
      message: STRINGS.RESPONSES.ERROR_SERVER, // Use predefined server error message from strings file
      error: error.message // Include the actual error message for debugging
    }));
  }
}

// This block of code below was assisted by Claude Sonnet 4 (https://claude.ai/)
async function handleCustomQuery(request, response, userId) { // Async function to handle custom SQL queries from client
  try { // Start try-catch block to handle parsing and database errors
    const data = await parsePostData(request); // Parse the JSON data from POST request body
    
    if (!data.query) { // Check if the query field is missing or empty
      response.writeHead(400); // Set HTTP status code to 400 (Bad Request)
      response.end(JSON.stringify({ // Send error response as JSON
        success: false, // Indicate operation failed
        message: STRINGS.RESPONSES.ERROR_MISSING_QUERY // Use predefined missing query error message
      }));
      return; // Exit function early since query is missing
    }

    const result = await db.executeQuery(data.query); // Execute the SQL query using database class
    
    // Track API usage
    if (userId) {
      await db.incrementApiCalls(userId);
      await db.logApiUsage(userId, '/api/v1/sql', 'POST');
      const apiLimit = await db.checkApiLimit(userId);
      result.apiLimitExceeded = apiLimit.exceeded;
    }
    
    const statusCode = result.success ? 200 : 400; // Set status code: 200 if successful, 400 if query failed
    
    response.writeHead(statusCode); // Set the determined HTTP status code
    response.end(JSON.stringify(result)); // Send query result back to client as JSON
  } catch (error) { // If any error occurs during request parsing or database operation
    response.writeHead(500); // Set HTTP status code to 500 (Internal Server Error)
    response.end(JSON.stringify({ // Send error response as JSON
      success: false, // Indicate operation failed
      message: STRINGS.RESPONSES.ERROR_SERVER, // Use predefined server error message
      error: error.message // Include actual error message for debugging
    }));
  }
}

// This block of code below was assisted by Claude Sonnet 4 (https://claude.ai/)
async function handleGetQuery(request, response, userId) { // Async function to handle GET requests with SQL queries in URL path
  try { // Start try-catch block to handle URL parsing and database errors
    // Use WHATWG URL API instead of deprecated url.parse()
    const baseUrl = `http://${request.headers.host || 'localhost'}`;
    const parsedUrl = new URL(request.url, baseUrl); // Parse the incoming URL to extract components (pathname, query params, etc.)
    const pathParts = parsedUrl.pathname.split('/'); // Split URL path by '/' to get array of path segments
    
    if (pathParts.length >= 4 && pathParts[3] === 'sql') { // Check if URL has at least 4 parts and 4th part is 'sql' (/api/v1/sql/query)
      const query = decodeURIComponent(pathParts[4] || ''); // Extract and decode the SQL query from 5th path segment (URL encoded)
      
      if (!query) { // Check if query is empty or missing after decoding
        response.writeHead(400); // Set HTTP status to 400 (Bad Request) for missing query
        response.end(JSON.stringify({ // Send error response as JSON
          success: false, // Indicate operation failed
          message: STRINGS.RESPONSES.ERROR_MISSING_QUERY // Use predefined missing query error message
        }));
        return; // Exit function early since no query to process
      }

      const result = await db.executeQuery(query); // Execute the decoded SQL query using database class
      
      // Track API usage
      if (userId) {
        await db.incrementApiCalls(userId);
        await db.logApiUsage(userId, '/api/v1/sql', 'GET');
        const apiLimit = await db.checkApiLimit(userId);
        result.apiLimitExceeded = apiLimit.exceeded;
      }
      
      const statusCode = result.success ? 200 : 400; // Set status code: 200 if query successful, 400 if query failed
      
      response.writeHead(statusCode); // Set the determined HTTP status code
      response.end(JSON.stringify(result)); // Send query result back to client as JSON
    } else { // If URL path doesn't match expected pattern (/api/v1/sql/...)
      response.writeHead(404); // Set HTTP status to 404 (Not Found) for invalid endpoint
      response.end(JSON.stringify({ // Send error response as JSON
        success: false, // Indicate operation failed
        message: 'Endpoint not found' // Indicate the requested endpoint doesn't exist
      }));
    }
  } catch (error) { // If any error occurs during URL parsing or database operation
    response.writeHead(500); // Set HTTP status to 500 (Internal Server Error)
    response.end(JSON.stringify({ // Send error response as JSON
      success: false, // Indicate operation failed
      message: STRINGS.RESPONSES.ERROR_SERVER, // Use predefined server error message
      error: error.message // Include actual error message for debugging
    }));
  }
}

const server = http.createServer(async (request, response) => { // Create HTTP server with async callback for each request
  setCORSHeaders(response, request); // Set CORS headers to allow cross-origin requests from different domains
  
  // Handle preflight OPTIONS requests for CORS
  if (request.method === 'OPTIONS') {
    // CORS headers are already set by setCORSHeaders above
    response.writeHead(200);
    response.end();
    return;
  }

  // Use WHATWG URL API instead of deprecated url.parse()
  const baseUrl = `http://${request.headers.host || 'localhost'}`;
  const parsedUrl = new URL(request.url, baseUrl); // Parse incoming URL to extract pathname and query parameters
  const pathname = parsedUrl.pathname; // Extract just the path part of URL (e.g., '/api/v1/sql')

  try { // Start try-catch block to handle any routing or processing errors
    // Authentication endpoints (no auth required)
    if (pathname === '/api/auth/signup' && request.method === 'POST') {
      await handleSignup(request, response);
      return;
    }
    
    if (pathname === '/api/auth/login' && request.method === 'POST') {
      await handleLogin(request, response);
      return;
    }
    
    if (pathname === '/api/auth/me' && request.method === 'GET') {
      await handleCurrentUser(request, response);
      return;
    }
    
    // Protected endpoints - require authentication
    let user = null;
    if (pathname !== '/api/auth/signup' && pathname !== '/api/auth/login') {
      user = await authenticateRequest(request);
      if (!user) {
        response.writeHead(401);
        response.end(JSON.stringify({
          success: false,
          message: STRINGS.RESPONSES.ERROR_AUTHENTICATION
        }));
        return;
      }
    }
    
    const userId = user ? user.user_id : null;
    
    if (request.method === 'POST') { // Check if incoming request is a POST method
      if (pathname === '/api/v1/patients/default') { // Route for inserting default patients via POST
        await handleInsertDefault(response, userId); // Call function to insert 4 predefined patients
      } else if (pathname === '/api/v1/sql') { // Route for custom SQL queries via POST
        await handleCustomQuery(request, response, userId); // Call function to handle custom SQL from request body
      } else { // If POST request doesn't match any known endpoints
        response.writeHead(404); // Set HTTP status to 404 (Not Found)
        response.end(JSON.stringify({ // Send error response as JSON
          success: false, // Indicate operation failed
          message: 'Endpoint not found' // Indicate the requested endpoint doesn't exist
        }));
      }
    } else if (request.method === 'GET') { // Check if incoming request is a GET method
      if (pathname.startsWith('/api/v1/sql/')) { // Route for SQL queries embedded in URL path (for SELECT)
        await handleGetQuery(request, response, userId); // Call function to handle SQL query from URL
      } else { // If GET request doesn't match any known endpoints
        response.writeHead(404); // Set HTTP status to 404 (Not Found)
        response.end(JSON.stringify({ // Send error response as JSON
          success: false, // Indicate operation failed
          message: 'Endpoint not found' // Indicate the requested endpoint doesn't exist
        }));
      }
    } else { // If request method is neither POST nor GET (e.g., PUT, DELETE, PATCH)
      response.writeHead(405); // Set HTTP status to 405 (Method Not Allowed)
      response.end(JSON.stringify({ // Send error response as JSON
        success: false, // Indicate operation failed
        message: STRINGS.RESPONSES.ERROR_METHOD // Use predefined method not allowed error message
      }));
    }
  } catch (error) { // If any unexpected error occurs during request processing
    response.writeHead(500); // Set HTTP status to 500 (Internal Server Error)
    response.end(JSON.stringify({ // Send error response as JSON
      success: false, // Indicate operation failed
      message: STRINGS.RESPONSES.ERROR_SERVER, // Use predefined server error message
      error: error.message // Include actual error message for debugging
    }));
  }
});

// This block of code below was assisted by Claude Sonnet 4 (https://claude.ai/)
async function startServer() { // Async function to initialize and start the HTTP server
  const connected = await db.connect(); // Attempt to connect to MySQL database
  if (!connected) { // If database connection failed
    console.error('Failed to connect to database. Exiting...'); // Log error message
    process.exit(1); // Exit the application with error code 1
  }

  const port = process.env.PORT || process.env.SERVER_PORT || 3000; // Get port from environment variable or default to 3000
  const host = '0.0.0.0'; // Force 0.0.0.0 for hosting platform compatibility
  
  // Debug logging for environment variables
  console.log('Environment variables:');
  console.log('- NODE_ENV:', process.env.NODE_ENV);
  console.log('- PORT:', process.env.PORT);
  console.log('- SERVER_PORT:', process.env.SERVER_PORT);
  console.log('- SERVER_HOST:', process.env.SERVER_HOST);
  console.log('Final configuration - Port:', port, 'Host:', host);
  
  server.listen(port, host, () => { // Start the HTTP server listening on specified port and host
    console.log(`${STRINGS.SERVER.STARTUP} ${port} on ${host}`); // Log server startup message with port and host
  });
}

process.on('SIGINT', async () => { // Listen for Ctrl+C (SIGINT signal) to gracefully shutdown
  console.log('Shutting down server...'); // Log shutdown message
  await db.close(); // Close database connection properly
  process.exit(0); // Exit the application with success code 0
});

startServer(); // Call the function to start the server