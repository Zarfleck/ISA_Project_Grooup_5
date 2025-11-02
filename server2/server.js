/*
Claude Sonnet 4 (https://claude.ai/) was used to generate the following code solutions in this assignment:

    1. API Route Handling - The handleInsertDefault(), handleCustomQuery(), and handleGetQuery() functions for processing different types of database operations.

    2. Error Handling - Comprehensive try-catch blocks with proper HTTP status codes and JSON error responses.

    3. Database Integration - The server startup sequence with database connection validation and graceful shutdown handling.

*/

// Load environment variables (always try .env file, then use platform env vars)
try {
  require('dotenv').config({ path: __dirname + '/.env' });
  console.log('Loaded .env file successfully');
} catch (error) {
  console.log('Dotenv not available, using platform environment variables only');
}
const http = require('http');
const url = require('url');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Database = require('./database');
const STRINGS = require('./lang/messages/en/user');

const db = new Database();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d'; // Token expires in 7 days

function setCORSHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Content-Type', 'application/json');
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.trim().split('=');
    if (parts.length === 2) {
      cookies[parts[0]] = decodeURIComponent(parts[1]);
    }
  });
  return cookies;
}

function extractToken(request) {
  // Try to get token from Authorization header first
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Then try to get from cookies
  const cookies = parseCookies(request.headers.cookie);
  return cookies.token || null;
}

async function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.findUserById(decoded.userId);
    if (!user) {
      return null;
    }
    return user;
  } catch (error) {
    return null;
  }
}

async function requireAuth(request) {
  const token = extractToken(request);
  if (!token) {
    return { authenticated: false, user: null };
  }
  
  const user = await verifyToken(token);
  if (!user) {
    return { authenticated: false, user: null };
  }
  
  return { authenticated: true, user };
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

async function handleSignUp(request, response) {
  try {
    const data = await parsePostData(request);
    
    if (!data.firstName || !data.email) {
      response.writeHead(400);
      response.end(JSON.stringify({
        success: false,
        message: STRINGS.RESPONSES.ERROR_MISSING_FIELDS
      }));
      return;
    }

    // Generate a simple password if not provided (for demo purposes, or require password)
    const tempPassword = data.password;
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    const result = await db.createUser(data.firstName, data.email, hashedPassword);
    
    if (!result.success) {
      const statusCode = result.message === STRINGS.RESPONSES.ERROR_EMAIL_EXISTS ? 409 : 500;
      response.writeHead(statusCode);
      response.end(JSON.stringify(result));
      return;
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: result.userId, email: data.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Set httpOnly cookie (use Secure and SameSite=None only in production with HTTPS)
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieFlags = isProduction 
      ? `token=${token}; HttpOnly; Path=/; SameSite=None; Secure; Max-Age=${7 * 24 * 60 * 60}`
      : `token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}`;
    response.setHeader('Set-Cookie', cookieFlags);
    
    response.writeHead(200);
    response.end(JSON.stringify({
      success: true,
      message: STRINGS.RESPONSES.SUCCESS_REGISTER,
      token: token,
      user: {
        id: result.userId,
        firstName: data.firstName,
        email: data.email
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

async function handleLogin(request, response) {
  try {
    const data = await parsePostData(request);
    
    if (!data.email) {
      response.writeHead(400);
      response.end(JSON.stringify({
        success: false,
        message: STRINGS.RESPONSES.ERROR_INVALID_CREDENTIALS
      }));
      return;
    }

    const user = await db.findUserByEmail(data.email);
    if (!user) {
      response.writeHead(401);
      response.end(JSON.stringify({
        success: false,
        message: STRINGS.RESPONSES.ERROR_INVALID_CREDENTIALS
      }));
      return;
    }

    // If password is provided, verify it
    if (data.password) {
      const isValid = await bcrypt.compare(data.password, user.password);
      if (!isValid) {
        response.writeHead(401);
        response.end(JSON.stringify({
          success: false,
          message: STRINGS.RESPONSES.ERROR_INVALID_CREDENTIALS
        }));
        return;
      }
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Set httpOnly cookie (use Secure and SameSite=None only in production with HTTPS)
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieFlags = isProduction 
      ? `token=${token}; HttpOnly; Path=/; SameSite=None; Secure; Max-Age=${7 * 24 * 60 * 60}`
      : `token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}`;
    response.setHeader('Set-Cookie', cookieFlags);
    
    response.writeHead(200);
    response.end(JSON.stringify({
      success: true,
      message: STRINGS.RESPONSES.SUCCESS_LOGIN,
      token: token,
      user: {
        id: user.id,
        firstName: user.firstName,
        email: user.email,
        apiCallsUsed: user.apiCallsUsed
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

async function trackApiCall(userId) {
  await db.incrementApiCalls(userId);
  const user = await db.findUserById(userId);
  const apiCallsUsed = user ? user.apiCallsUsed : 0;
  const isMaxed = apiCallsUsed >= STRINGS.API_LIMITS.FREE_TIER;
  
  return {
    apiCallsUsed,
    isMaxed,
    warning: isMaxed ? STRINGS.RESPONSES.ERROR_MAX_API_CALLS : null
  };
}

// This block of code below was assisted by Claude Sonnet 4 (https://claude.ai/)
async function handleInsertDefault(request, response) { // Async function to handle inserting default patients, takes HTTP response object
  try {
    // Check authentication
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      response.writeHead(401);
      response.end(JSON.stringify({
        success: false,
        message: STRINGS.RESPONSES.ERROR_UNAUTHORIZED
      }));
      return;
    }

    // Track API call
    const apiInfo = await trackApiCall(auth.user.id);
    
    const result = await db.insertDefaultPatients(); // Call database method to insert 4 predefined patients, wait for completion
    
    // Add API call tracking info to response
    result.apiCallsUsed = apiInfo.apiCallsUsed;
    result.apiLimitWarning = apiInfo.warning;
    
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
async function handleCustomQuery(request, response) { // Async function to handle custom SQL queries from client
  try {
    // Check authentication
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      response.writeHead(401);
      response.end(JSON.stringify({
        success: false,
        message: STRINGS.RESPONSES.ERROR_UNAUTHORIZED
      }));
      return;
    }

    // Track API call
    const apiInfo = await trackApiCall(auth.user.id);
    
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
    
    // Add API call tracking info to response
    result.apiCallsUsed = apiInfo.apiCallsUsed;
    result.apiLimitWarning = apiInfo.warning;
    
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
async function handleGetQuery(request, response) { // Async function to handle GET requests with SQL queries in URL path
  try {
    // Check authentication
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      response.writeHead(401);
      response.end(JSON.stringify({
        success: false,
        message: STRINGS.RESPONSES.ERROR_UNAUTHORIZED
      }));
      return;
    }

    // Track API call
    const apiInfo = await trackApiCall(auth.user.id);
    
    const parsedUrl = url.parse(request.url, true); // Parse the incoming URL to extract components (pathname, query params, etc.)
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
      
      // Add API call tracking info to response
      result.apiCallsUsed = apiInfo.apiCallsUsed;
      result.apiLimitWarning = apiInfo.warning;
      
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
  setCORSHeaders(response); // Set CORS headers to allow cross-origin requests from different domains
  
  // Handle preflight OPTIONS requests for CORS
  if (request.method === 'OPTIONS') {
    response.writeHead(200);
    response.end();
    return;
  }

  const parsedUrl = url.parse(request.url, true); // Parse incoming URL to extract pathname and query parameters
  const pathname = parsedUrl.pathname; // Extract just the path part of URL (e.g., '/api/v1/sql')

  try { // Start try-catch block to handle any routing or processing errors
    if (request.method === 'POST') { // Check if incoming request is a POST method
      if (pathname === '/api/v1/auth/register') { // Route for user registration
        await handleSignUp(request, response);
      } else if (pathname === '/api/v1/auth/login') { // Route for user login
        await handleLogin(request, response);
      } else if (pathname === '/api/v1/patients/default') { // Route for inserting default patients via POST
        await handleInsertDefault(request, response); // Call function to insert 4 predefined patients
      } else if (pathname === '/api/v1/sql') { // Route for custom SQL queries via POST
        await handleCustomQuery(request, response); // Call function to handle custom SQL from request body
      } else { // If POST request doesn't match any known endpoints
        response.writeHead(404); // Set HTTP status to 404 (Not Found)
        response.end(JSON.stringify({ // Send error response as JSON
          success: false, // Indicate operation failed
          message: 'Endpoint not found' // Indicate the requested endpoint doesn't exist
        }));
      }
    } else if (request.method === 'GET') { // Check if incoming request is a GET method
      if (pathname.startsWith('/api/v1/sql/')) { // Route for SQL queries embedded in URL path (for SELECT)
        await handleGetQuery(request, response); // Call function to handle SQL query from URL
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