// API base URL for backend server (cannot use env vars in frontend)
// export const BACKEND_SERVER_URL = "http://localhost:3000/api";

// // Actual Common Deployed Backend
export const BACKEND_SERVER_URL =
  "https://comp4537-group5-9lwth.ondigitalocean.app/api";

// Route for TTS now proxies through the backend so API usage is tracked
export const AI_SERVER_URL = `${BACKEND_SERVER_URL}/tts`;

const UI_STRINGS = {
  ERROR_UNAUTHORIZED:
    "You must be logged in to use this service. Please register or login.",
  API_LIMIT_WARNING:
    "You have reached your maximum free API calls (20). You can't use our AI service until the limit reset for you by admin.",
};

export { UI_STRINGS };
