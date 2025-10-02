import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone_number: { type: String },
  password: { 
    type: String, 
    required: function() { return !this.google_id; } // Required only if not a Google user
  },
  vehicle_number: { type: String, unique: true, sparse: true },
  vehicle_type: { type: String },
  role: { type: String, default: "user" },
  is_verified: { type: Boolean, default: false },
  verification_token: { type: String },
  is_blocked: { type: Boolean, default: false },
  otp_code: { type: String },
  otp_expiry: { type: Date },
  google_id: { type: String, unique: true, sparse: true }, // Google OAuth ID
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
export default User;
