// Cookie helper functions

export function setTokenCookie(response, token) {
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
  response.cookie("token", token, cookieOptions);
}

export function clearTokenCookie(response) {
  response.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/",
  });
}

