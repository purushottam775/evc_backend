import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/sendEmail.js";
import dotenv from "dotenv";
dotenv.config();

// Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails[0].value;

        // 1️⃣ Check if a user exists with this Google ID
        let user = await User.findOne({ google_id: profile.id });
        if (user) return done(null, user); // Existing Google user

        // 2️⃣ Check if email exists (manual registration)
        user = await User.findOne({ email });
        if (user) {
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

            // Send JSON response
            res.status(200).json({
                message,
                token,
                user: {
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    is_verified: user.is_verified
                }
            });

        } catch (error) {
            res.status(500).json({ message: "Server error", error: error.message });
        }
    })(req, res, next);
};
