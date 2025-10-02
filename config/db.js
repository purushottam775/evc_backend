import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables first

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI); // no deprecated options
    console.log("MongoDB Connected");
  } catch (err) {
    console.error("Database connection failed:", err.message);
    process.exit(1); // stop server if DB connection fails
  }
};

export default connectDB;
