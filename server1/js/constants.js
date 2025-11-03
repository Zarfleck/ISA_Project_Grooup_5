// API base URL for backend server (cannot use env vars in frontend)
// export const BACKEND_SERVER_URL = 'http://localhost:3000/api';
export const BACKEND_SERVER_URL =
  "https://comp4537-group5-9lwth.ondigitalocean.app/api";

// Base URL for the standalone AI (text-to-speech) microservice
export const AI_SERVER_URL = "https://tree-fares-aluminium-bool.trycloudflare.com/api/v1/tts";

const UI_STRINGS = {
  ERROR_UNAUTHORIZED:
    "You must be logged in to use this service. Please register or login.",
  API_LIMIT_WARNING:
    "You have reached your maximum free API calls (20). Service continues with warning.",
};

export { UI_STRINGS };
