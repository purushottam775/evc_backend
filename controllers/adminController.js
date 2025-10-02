import bcrypt from "bcryptjs";
import Admin from "../models/Admin.js";
import { generateToken } from "../utils/token.js";

// Allowed roles
const ALLOWED_ROLES = ["super admin", "station manager"];

// Helper: validate email
const isValidEmail = (email) => {
  const re = /\S+@\S+\.\S+/;
  return re.test(email);
};

// ------------------- Register Admin -------------------
export const registerAdmin = async (req, res) => {
  const { name, email, password, role } = req.body || {};

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ message: "Request body is required" });
  }

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (!isValidEmail(email)) return res.status(400).json({ message: "Invalid email format" });

  if (!ALLOWED_ROLES.includes(role)) {
    return res
      .status(400)
      .json({ message: `Role must be one of: ${ALLOWED_ROLES.join(", ")}` });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters long" });
  }

  try {
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = await Admin.create({
      name,
      email,
      password: hashedPassword,
      role,
    });

    res.status(201).json({
      message: "Admin registered successfully",
      user: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ------------------- Login Admin -------------------
export const loginAdmin = async (req, res) => {
  const { email, password } = req.body || {};

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ message: "Request body is required" });
  }

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const userData = {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      isAdmin: true,
    };

    res.json({
      message: "Login successful",
      token: generateToken({ id: admin._id, role: admin.role }),
      user: userData,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ------------------- Dashboard -------------------
export const getDashboard = (req, res) => {
  try {
    if (!req.admin) return res.status(401).json({ message: "Admin not found or unauthorized" });

    res.json({
      message: "Admin dashboard data fetched successfully",
      user: req.admin,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
