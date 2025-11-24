// // Local backend server (cannot use env vars in frontend)
// export const BACKEND_SERVER_URL = "http://localhost:3000/api";

// Deployed Backend server
export const BACKEND_SERVER_URL =
  "https://comp4537-group5-9lwth.ondigitalocean.app/api";

// Route for TTS now proxies through the backend so API usage is tracked
export const AI_SERVER_URL = `${BACKEND_SERVER_URL}/tts`;

export const ROUTES = {
  LOGIN: "/views/login.html",
  HOME: "/views/home.html",
  HOME_AUTHENTICATED: "/views/home.html?authenticated=true",
};

export const AUTH_STORAGE_KEYS = {
  TOKEN: "auth_token",
  EMAIL: "auth_email",
  RESET_CODE: "auth_reset_code",
  SESSION_FLAG: "auth_session",
};

export const AUTH_SESSION_ACTIVE_VALUE = "1";

export const EVENTS = {
  INCLUDES_LOADED: "includesLoaded",
};

export const INCLUDE_SELECTORS = {
  TARGET: "[data-include]",
  ATTRIBUTE: "data-include",
};

const AUDIO_MIME_WAV = "audio/wav";

const UI_STRINGS = {
  ERROR_UNAUTHORIZED:
    "You must be logged in to use this service. Please register or login.",
  API_LIMIT_WARNING:
    "You have reached your maximum free API calls (20). You can't use our AI service until the limit reset for you by admin.",
  HEADER: {
    FALLBACK_USER: "User",
    LOAD_ERROR_PREFIX: "Failed to load user info:",
  },
  INCLUDE: {
    FETCH_FAILURE_PREFIX: "Failed to include",
    HTTP_STATUS_LABEL: "HTTP",
  },
  HOME: {
    API_USAGE_TEXT: ({ used, limit, remaining }) =>
      `used ${used} of ${limit} AI API calls used. (${remaining} remaining)`,
    PLAYER_READY: "Playback ready. Click play to listen.",
    PLAYER_LOADING: "Generating audio, please wait...",
    PLAYER_ERROR: "Failed to generate audio. Please try again.",
    PLAYER_DISABLED:
      "Audio is currently disabled. Generate speech to enable playback.",
    API_LIMIT_REACHED: "You have reached your API call limit.",
    ENTER_TEXT: "Please enter some text to synthesize.",
    DOWNLOAD_FALLBACK: "generated_speech.wav",
    BUTTON_GENERATING: "Generating...",
    BUTTON_DEFAULT: "Create Speech (Audio)",
    MISSING_AUDIO_DATA: "No audio data returned from synthesis service.",
    TOKEN_EXPIRED_PREFIX: "Token invalid or expired:",
    CURRENT_USER_PREFIX: "Current user:",
    MISSING_DOM: "Required DOM elements for text-to-speech are missing.",
    FETCH_USER_FAILURE_PREFIX: "Failed to fetch user info:",
    SYNTHESIS_FAILURE_PREFIX: "Failed to synthesize speech:",
    LOGOUT_FAILURE_PREFIX: "Logout API call failed:",
  },
  LOGIN: {
    LOGGING_IN: "Logging in...",
    SUCCESS_PREFIX: "Success!",
    ERROR_PREFIX: "Error:",
    ERROR_LOG_PREFIX: "Login error:",
  },
  SIGNUP: {
    PASSWORD_MISMATCH: "Passwords do not match.",
    REGISTERING: "Registering...",
    SUCCESS_PREFIX: "Success!",
    ERROR_PREFIX: "Error:",
    ERROR_LOG_PREFIX: "Registration error:",
  },
  API_CLIENT: {
    REQUEST_FAILED: (status) => `Request failed (${status})`,
    TEXT_REQUIRED: "Text is required when requesting speech synthesis.",
  },
  AUDIO: {
    NO_AUDIO: "No audio data received from synthesis service.",
    MIME_WAV: AUDIO_MIME_WAV,
  },
};

export const AUDIO_MIME_TYPES = {
  WAV: AUDIO_MIME_WAV,
};

export { UI_STRINGS };
