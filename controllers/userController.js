import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/User.js";
import { generateToken } from "../utils/token.js";
import { sendEmail } from "../utils/sendEmail.js";
import { generateOTP } from "../utils/generateOTP.js";
import { otpTemplate } from "../utils/emailTemplates.js";

// ---------------- Register User ----------------
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone_number, vehicle_number, vehicle_type } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ message: "Invalid email format." });

    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });

    // Check existing user
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "User already exists." });

    if (vehicle_number) {
      const existingVehicle = await User.findOne({ vehicle_number });
      if (existingVehicle) return res.status(400).json({ message: "Vehicle number already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const newUser = new User({
      name,
      email,
      phone_number,
      password: hashedPassword,
      vehicle_number,
      vehicle_type,
      verification_token: verificationToken,
      is_verified: false
    });

    await newUser.save();

    const backendUrl = process.env.SERVER_URL || "http://localhost:5000";
    const verifyLink = `${backendUrl}/api/users/verify/${verificationToken}`;

    await sendEmail(
      email,
      "Verify your account",
      `<h2>Welcome, ${name}!</h2>
       <p>Please click the link below to verify your account:</p>
       <a href="${verifyLink}" target="_blank">${verifyLink}</a>`
    );

    res.status(201).json({ message: "Registration successful. Check your email to verify your account." });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ---------------- Verify User ----------------
export const verifyUser = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).send("<h2>Verification token is required.</h2>");

    const user = await User.findOne({ verification_token: token });
    if (!user) return res.status(400).send("<h2>Invalid or expired verification token.</h2>");

    user.is_verified = true;
    user.verification_token = null;
    await user.save();

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    res.send(`
      <div style="text-align:center; margin-top:50px;">
        <h1 style="color:green;">Your account has been verified!</h1>
        <p>You can now <a href="${clientUrl}/login">login</a>.</p>
      </div>
    `);
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).send("<h2>Server error. Please try again later.</h2>");
  }
};

// ---------------- Login User ----------------
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    if (user.is_blocked) return res.status(403).json({ message: "Your account is blocked. Contact admin." });
    if (!user.is_verified) return res.status(403).json({ message: "Please verify your email before logging in." });

     // If user registered via Google and has no password
    if (!user.password) {
      return res.status(400).json({ message: "This account uses Google login. Please login with Google." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = generateToken({ id: user._id, role: user.role });
    const { password: _, ...safeUser } = user.toObject();

    res.json({ message: "Login successful", token, user: safeUser });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ---------------- Forgot Password ----------------
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ message: "Invalid email format." });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.is_blocked) return res.status(403).json({ message: "Your account is blocked. Contact admin." });

    const otp = generateOTP(6);
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    user.otp_code = otp;
    user.otp_expiry = expiry;
    await user.save();

    await sendEmail(email, "Password Reset OTP", otpTemplate(user.name, otp));
    res.json({ message: "OTP sent to your email. Valid for 10 minutes." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ---------------- Reset Password with OTP ----------------
export const resetPasswordWithOTP = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ message: "Email, OTP, and new password are required." });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.is_blocked) return res.status(403).json({ message: "Your account is blocked. Contact admin." });

    if (user.otp_code !== otp) return res.status(400).json({ message: "Invalid OTP." });
    if (new Date() > user.otp_expiry) return res.status(400).json({ message: "OTP has expired. Request new one." });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.otp_code = null;
    user.otp_expiry = null;
    await user.save();

    await sendEmail(
      email,
      "Password Reset Successful",
      `<h2>Hello ${user.name},</h2>
       <p>Your password has been successfully reset.</p>`
    );

    res.json({ message: "Password reset successfully. Confirmation email sent." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ---------------- Get Profile ----------------
export const getProfile = async (req, res) => {
  try {
    res.json({ message: "User profile fetched successfully", user: req.user });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ---------------- Update Profile ----------------
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone_number, vehicle_number, vehicle_type } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (phone_number) updates.phone_number = phone_number;
    if (vehicle_number) updates.vehicle_number = vehicle_number;
    if (vehicle_type) updates.vehicle_type = vehicle_type;

    const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true }).select("-password");

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    res.json({ message: "Profile updated successfully", user: updatedUser });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
