// // API base URL for backend server (cannot use env vars in frontend)
// export const BACKEND_SERVER_URL = "http://localhost:3000/api";

// Actual Common Deployed Backend
export const BACKEND_SERVER_URL =
  "https://comp4537-group5-9lwth.ondigitalocean.app/api";

// // For admin module testing deployment
// export const BACKEND_SERVER_URL =
//   "https://comp4537-self-be-yy4b3.ondigitalocean.app/api";

// // Base URL for the standalone AI (text-to-speech) microservice Cloudflare
// export const AI_SERVER_URL =
//   "https://whereas-containing-investigations-believe.trycloudflare.com/api/v1/tts";

// Base URL for the standalone AI (text-to-speech) microservice Ngrok (NOT WORKING)
export const AI_SERVER_URL =
  "https://effortless-bogus-kaelyn.ngrok-free.dev/api/v1/tts";

const UI_STRINGS = {
  ERROR_UNAUTHORIZED:
    "You must be logged in to use this service. Please register or login.",
  API_LIMIT_WARNING:
    "You have reached your maximum free API calls (20). Service continues with warning.",
};

export { UI_STRINGS };
