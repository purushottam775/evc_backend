import Admin from "../models/Admin.js";
import { verifyToken } from "../utils/token.js";

export const adminProtect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ message: "Not authorized or token expired" });
    }

    // Fetch admin from MongoDB
    const admin = await Admin.findById(decoded.id).select("name email role");

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    req.admin = admin;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
