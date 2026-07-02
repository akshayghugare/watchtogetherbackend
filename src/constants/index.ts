export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL: 500,
} as const;

export const AUTH_MESSAGES = {
  REGISTER_SUCCESS: 'Account created. Please check your email to verify your account.',
  LOGIN_SUCCESS: 'Logged in successfully.',
  LOGOUT_SUCCESS: 'Logged out successfully.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  EMAIL_TAKEN: 'An account with this email already exists.',
  USERNAME_TAKEN: 'This username is already taken.',
  EMAIL_NOT_VERIFIED: 'Please verify your email before logging in.',
  EMAIL_VERIFIED: 'Email verified successfully. You can now log in.',
  VERIFICATION_RESENT: 'If the account exists, a verification email has been sent.',
  INVALID_TOKEN: 'Token is invalid or has expired.',
  UNAUTHORIZED: 'You are not logged in. Please log in to get access.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  PASSWORD_RESET_SENT: 'If the account exists, a password reset email has been sent.',
  PASSWORD_RESET_SUCCESS: 'Password has been reset. Please log in with your new password.',
  PASSWORD_CHANGED: 'Password changed successfully.',
  WRONG_CURRENT_PASSWORD: 'Current password is incorrect.',
  ACCOUNT_BANNED: 'This account has been suspended.',
  TOKEN_REFRESHED: 'Token refreshed.',
} as const;

export const USER_MESSAGES = {
  PROFILE_UPDATED: 'Profile updated successfully.',
  AVATAR_UPDATED: 'Profile photo updated successfully.',
  NOT_FOUND: 'User not found.',
} as const;

export const REFRESH_TOKEN_COOKIE = 'refreshToken';

export const TOKEN_TTL = {
  EMAIL_VERIFY_HOURS: 24,
  PASSWORD_RESET_MINUTES: 30,
} as const;
