// Auth token management and simple guards

const TOKEN_KEY = "auth_token";
const EMAIL_KEY = "auth_email"; // Used through the password reset flow
const RESET_CODE_KEY = "auth_reset_code";

// get/set/clear auth token in localStorage
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  let token = localStorage.getItem(TOKEN_KEY);

  // If not in localStorage, try to get from cookies
  if (!token) {
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === "token") {
        token = value;
        setToken(token); // Save to localStorage for future use
        break;
      }
    }
  }

  return token;
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Check if user is authenticated
// Note: httpOnly cookies cannot be read by JavaScript, so we check localStorage
// The server will verify via cookies automatically, but for client-side checks we use localStorage
export function isAuthenticated() {
  return !!getToken();
}

// Save/get email used in password reset flow
export function saveEmailForReset(email) {
  sessionStorage.setItem(EMAIL_KEY, email);
}

export function getSavedEmailForReset() {
  return sessionStorage.getItem(EMAIL_KEY);
}

// Save/get reset code used in password reset flow
export function saveResetCode(code) {
  sessionStorage.setItem(RESET_CODE_KEY, code);
}

export function getSavedResetCode() {
  return sessionStorage.getItem(RESET_CODE_KEY);
}

// Clear email and code from session storage
export function clearResetFlow() {
  sessionStorage.removeItem(EMAIL_KEY);
  sessionStorage.removeItem(RESET_CODE_KEY);
}

// Redirect to login if not authenticated
export function requireAuth(redirectTo = "login.html") {
  if (!isAuthenticated()) {
    window.location.href = redirectTo;
  }
}

// If user already logged in, navigate to home
export function redirectIfAuthenticated(target = "home.html") {
  if (isAuthenticated()) {
    window.location.href = target;
  }
}
