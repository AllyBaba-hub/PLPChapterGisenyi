export const LOGIN_ERROR_MESSAGES = {
  suspended: {
    title: "Account suspended",
    body: "Your membership account is currently suspended. Please contact PLP Chapter Gisenyi leadership if you think this is a mistake.",
  },
  "profile-missing": {
    title: "Profile not found",
    body: "We couldn't find a member profile for your account. Try signing in again, or contact the chapter if the problem continues.",
  },
  config: {
    title: "Sign-in unavailable",
    body: "Sign-in is temporarily unavailable because the site isn't configured correctly. Please try again later or contact the chapter.",
  },
} as const;

export type LoginErrorCode = keyof typeof LOGIN_ERROR_MESSAGES;

export const LOGIN_NOTICE_MESSAGES = {
  "signed-out": "You have been signed out.",
  "password-updated": "Your password was updated. Sign in with your new password.",
} as const;

export type LoginNotice = keyof typeof LOGIN_NOTICE_MESSAGES;

type ParamValue = string | string[] | undefined;

function firstValue(value: ParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseLoginError(value: ParamValue): LoginErrorCode | null {
  const candidate = firstValue(value);
  return candidate && Object.prototype.hasOwnProperty.call(LOGIN_ERROR_MESSAGES, candidate)
    ? (candidate as LoginErrorCode)
    : null;
}

export function parseLoginNotice(value: ParamValue): LoginNotice | null {
  const candidate = firstValue(value);
  return candidate && Object.prototype.hasOwnProperty.call(LOGIN_NOTICE_MESSAGES, candidate)
    ? (candidate as LoginNotice)
    : null;
}

export { firstValue as firstParam };
