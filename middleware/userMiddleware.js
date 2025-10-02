import User from "../models/User.js";
import { verifyToken } from "../utils/token.js";

export const userProtect = async (req, res, next) => {
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

    // Fetch user from MongoDB
    const user = await User.findById(decoded.id).select(
      "name email phone_number vehicle_number vehicle_type role is_blocked status"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Optionally block users
    if (user.is_blocked) {
      return res.status(403).json({ message: "Your account is blocked. Contact admin." });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
