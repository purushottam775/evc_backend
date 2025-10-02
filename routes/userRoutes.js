import express from 'express';
import { 
    registerUser, 
    loginUser, 
    getProfile, 
    updateProfile,
    forgotPassword,
    resetPasswordWithOTP,
    verifyUser,
    getUserStats
} from '../controllers/userController.js';
import { googleAuth, googleAuthCallback, verifyGoogleToken } from "../controllers/googleAuthController.js";
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
router.post("/google/verify", verifyGoogleToken);   // Step 3: verify Google JWT token

// Protected routes
router.get('/profile', userProtect, getProfile);
router.put('/profile', userProtect, updateProfile);
router.get('/stats/:id', userProtect, getUserStats);

export default router;
