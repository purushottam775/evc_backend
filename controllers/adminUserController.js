import User from "../models/User.js";

// ------------------- Get all users -------------------
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select(
      "name email phone_number vehicle_number vehicle_type role is_blocked createdAt updatedAt"
    );
    res.status(200).json({ success: true, users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ------------------- Block a user -------------------
export const blockUser = async (req, res) => {
  const { user_id } = req.params;
  try {
    const user = await User.findByIdAndUpdate(user_id, { is_blocked: true }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.status(200).json({ success: true, message: "User blocked successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ------------------- Unblock a user -------------------
export const unblockUser = async (req, res) => {
  const { user_id } = req.params;
  try {
    const user = await User.findByIdAndUpdate(user_id, { is_blocked: false }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.status(200).json({ success: true, message: "User unblocked successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ------------------- Update user role/status -------------------
export const updateUser = async (req, res) => {
  const { user_id } = req.params;
  const { role, status } = req.body; // role: 'user'/'admin', status: 'active'/'inactive'

  try {
    const updates = {};
    if (role) updates.role = role;
    if (status) updates.status = status;

    const user = await User.findByIdAndUpdate(user_id, updates, { new: true }).select(
      "name email phone_number vehicle_number vehicle_type role status is_blocked"
    );

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.status(200).json({ success: true, message: "User updated successfully", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ------------------- Delete a user -------------------
export const deleteUser = async (req, res) => {
  const { user_id } = req.params;
  try {
    const user = await User.findByIdAndDelete(user_id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.status(200).json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
