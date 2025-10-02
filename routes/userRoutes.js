import express from 'express';
import { 
    registerUser, 
    loginUser, 
    getProfile, 
    updateProfile,
    forgotPassword,
    resetPasswordWithOTP,
    verifyUser 
} from '../controllers/userController.js';
import { googleAuth, googleAuthCallback } from "../controllers/googleAuthController.js";
import { userProtect } from '../middleware/userMiddleware.js';

const router = express.Router();

// Public routes
router.post('/register', registerUser);
router.get('/verify/:token', verifyUser);
router.post('/login', loginUser);
router.post('/reset-password', forgotPassword);
router.post('/reset-password/confirm', resetPasswordWithOTP);

// Google OAuth
router.get("/google", googleAuth);                  // Step 1: redirect to Google
router.get("/google/callback", googleAuthCallback); // Step 2: handle Google response

// Protected routes
router.get('/profile', userProtect, getProfile);
router.put('/profile', userProtect, updateProfile);

export default router;
