import { Router } from 'express';
import * as controller from './auth.controller';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.validator';
import { validate } from '../../middleware/validate.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import { authLimiter } from '../../middleware/rateLimit.middleware';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), controller.register);
router.post('/login', authLimiter, validate(loginSchema), controller.login);
router.post('/refresh-token', controller.refresh);
router.post('/logout', controller.logout);

router.get('/verify-email/:token', validate(verifyEmailSchema), controller.verifyEmail);
router.post(
  '/resend-verification',
  authLimiter,
  validate(resendVerificationSchema),
  controller.resendVerification,
);

router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password/:token', authLimiter, validate(resetPasswordSchema), controller.resetPassword);

router.post('/change-password', requireAuth, validate(changePasswordSchema), controller.changePassword);

export default router;
