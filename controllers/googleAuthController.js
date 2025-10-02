import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/sendEmail.js";
import dotenv from "dotenv";
dotenv.config();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails[0].value;

        // 1️⃣Check if a user exists with this Google ID
        let user = await User.findOne({ google_id: profile.id });
        if (user) {
            // Check if user is blocked
            if (user.is_blocked) {
                return done(new Error("Your account is blocked. Contact admin."), null);
            }
            return done(null, user); // Existing Google user
        }

        // 2️⃣ Check if email exists (manual registration)
        user = await User.findOne({ email });
        if (user) {
            // Check if user is blocked
            if (user.is_blocked) {
                return done(new Error("Your account is blocked. Contact admin."), null);
            }
            
            // Link Google account to existing manual user
            user.google_id = profile.id;
            user.is_verified = true; // Optional: mark as verified
            await user.save();

            return done(null, user, { message: "Linked existing user with Google" });
        }

        // 3️⃣ If completely new user, create Google user
        user = await User.create({
            name: profile.displayName,
            email,
            google_id: profile.id,
            is_verified: true,
        });

        // Send welcome email
        const subject = "Welcome to EV Charge System!";
        const html = `<h2>Hello ${user.name},</h2>
                      <p>Welcome! Your account is created via Google login.</p>`;
        await sendEmail(user.email, subject, html);

        done(null, user, { message: "New Google user created" });

    } catch (err) {
        done(err, null);
    }
}));

// Step 1: Redirect to Google
export const googleAuth = (req, res, next) => {
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
};

// Step 2: Handle callback
export const googleAuthCallback = (req, res, next) => {
    passport.authenticate("google", { session: false }, async (err, user, info) => {
        if (err || !user) {
            // Check if it's a blocked user error
            if (err && err.message && err.message.includes("blocked")) {
                const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
                const errorUrl = `${frontendUrl}/auth/google/callback?error=account_blocked&error_description=${encodeURIComponent(err.message)}`;
                return res.redirect(errorUrl);
            }
            return res.status(400).json({ message: "Authentication failed", error: err || info });
        }

        try {
            // Create JWT
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

            // Determine message based on user state
            let message = "Login successful!";
            if (info?.message === "New Google user created") {
                message = "Registration successful via Google login!";
            } else if (info?.message === "Linked existing user with Google") {
                message = "Google account linked to your existing account. Login successful!";
            }

            // For frontend redirect flow, send as URL parameters
            const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
            const userData = {
                name: user.name,
                email: user.email,
                role: user.role,
                is_verified: user.is_verified,
                isAdmin: user.role === 'super admin' || user.role === 'station manager'
            };
            
            const redirectUrl = `${frontendUrl}/auth/google/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(userData))}&message=${encodeURIComponent(message)}`;
            
            res.redirect(redirectUrl);

        } catch (error) {
            const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
            const errorUrl = `${frontendUrl}/auth/google/callback?error=server_error&error_description=${encodeURIComponent(error.message)}`;
            res.redirect(errorUrl);
        }
    })(req, res, next);
};

// Verify Google JWT token (for credential flow)
export const verifyGoogleToken = async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ message: "Google token is required" });
        }

        // Verify the Google JWT token
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, name, email_verified } = payload;

        if (!email_verified) {
            return res.status(400).json({ message: "Google email not verified" });
        }

        // Check if user exists with Google ID
        let user = await User.findOne({ google_id: googleId });
        if (user) {
            // Check if user is blocked
            if (user.is_blocked) {
                return res.status(403).json({ message: "Your account is blocked. Contact admin." });
            }
            
            // Existing Google user
            const jwtToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
            
            return res.status(200).json({
                message: "Login successful!",
                token: jwtToken,
                user: {
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    is_verified: user.is_verified,
                    isAdmin: user.role === 'super admin' || user.role === 'station manager'
                }
            });
        }

        // Check if email exists (manual registration)
        user = await User.findOne({ email });
        if (user) {
            // Check if user is blocked
            if (user.is_blocked) {
                return res.status(403).json({ message: "Your account is blocked. Contact admin." });
            }
            
            // Link Google account to existing manual user
            user.google_id = googleId;
            user.is_verified = true;
            await user.save();

            const jwtToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
            
            return res.status(200).json({
                message: "Google account linked to your existing account. Login successful!",
                token: jwtToken,
                user: {
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    is_verified: user.is_verified,
                    isAdmin: user.role === 'super admin' || user.role === 'station manager'
                }
            });
        }

        // Create new Google user
        user = await User.create({
            name,
            email,
            google_id: googleId,
            is_verified: true,
        });

        // Send welcome email
        const subject = "Welcome to EV Charge System!";
        const html = `<h2>Hello ${user.name},</h2>
                      <p>Welcome! Your account is created via Google login.</p>`;
        await sendEmail(user.email, subject, html);

        const jwtToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
        
        res.status(201).json({
            message: "Registration successful via Google login!",
            token: jwtToken,
            user: {
                name: user.name,
                email: user.email,
                role: user.role,
                is_verified: user.is_verified,
                isAdmin: user.role === 'super admin' || user.role === 'station manager'
            }
        });

    } catch (error) {
        console.error("Google token verification error:", error);
        res.status(500).json({ message: "Google authentication failed", error: error.message });
    }
};
