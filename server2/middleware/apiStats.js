// Universal API logging middleware factory
// Creates middleware for any route type

export function createApiStatsMiddleware(db, STRINGS, pathPrefix = "") {
  return async (req, res, next) => {
    // Store original end function
    const originalEnd = res.end;

    // Override end function to log after response
    res.end = function (...args) {
      // Call original end function first
      originalEnd.apply(this, args);

      // Log API usage asynchronously (don't block response)
      const user = req.user || req.admin; // Works for both user and admin routes
      if (user && req.path.startsWith("/")) {
        // Use setImmediate to avoid blocking the response
        setImmediate(async () => {
          try {
            const fullPath = pathPrefix + req.path;
            await db.logApiUsage(user.user_id, fullPath, req.method, "en");
          } catch (error) {
            console.error(STRINGS.LOGS.API_LOGGING_ERROR_PREFIX, error.message);
          }
        });
      }
    };

    next();
  };
}

