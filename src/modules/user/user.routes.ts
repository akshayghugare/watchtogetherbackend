import { Router } from 'express';
import * as controller from './user.controller';
import { updateProfileSchema } from './user.validator';
import { validate } from '../../middleware/validate.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import { avatarUpload } from '../../middleware/upload.middleware';

const router = Router();

router.use(requireAuth);

router.get('/me', controller.getMe);
router.patch('/me', validate(updateProfileSchema), controller.updateProfile);
router.post('/me/avatar', avatarUpload.single('avatar'), controller.uploadAvatar);

export default router;
