import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";   // MongoDB connection
import passport from "passport";
import session from "express-session";

// Import routes
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import adminUserRoutes from "./routes/adminUserRoutes.js";
import stationRoutes from "./routes/stationRoutes.js"; 
import slotRoutes from "./routes/slotRoutes.js"; 
import bookingUserRoutes from "./routes/bookingUserRoutes.js";
import bookingAdminRoutes from "./routes/bookingAdminRoutes.js";

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middleware - Enhanced CORS configuration
const allowedOrigins = [
  'https://ev-zh0a.onrender.com', // Your deployed frontend
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.log('CORS blocked origin:', origin);
    callback(new Error("CORS policy violation"));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Accept',
    'Origin',
    'X-Requested-With'
  ],
  optionsSuccessStatus: 200
}));

// CORS middleware already handles preflight requests

// Debug middleware for CORS and requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Origin:', req.headers.origin);
  console.log('User-Agent:', req.headers['user-agent']);
  
  // Add CORS headers manually as backup
  if (req.headers.origin) {
    const allowedOrigins = [
      'https://ev-zh0a.onrender.com',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000'
    ];
    
    if (allowedOrigins.includes(req.headers.origin)) {
      res.header('Access-Control-Allow-Origin', req.headers.origin);
    }
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept,Origin,X-Requested-With');
  
  next();
});

app.use(express.json());

// Initialize passport
app.use(passport.initialize());

// Optional: session for passport (not strictly needed if using JWT only)
app.use(session({
  secret: process.env.JWT_SECRET || "supersecretkey",
  resave: false,
  saveUninitialized: false
}));

// Root route
app.get("/", (req, res) => {
  res.send("EV Slot Management Backend is running with MongoDB!");
});

// Routes
app.use("/users", userRoutes);
app.use("/admins", adminRoutes);
app.use("/admins/users", adminUserRoutes);
app.use("/stations", stationRoutes);
app.use("/slots", slotRoutes);

// Booking routes
app.use("/bookings/user", bookingUserRoutes);   
app.use("/bookings/admin", bookingAdminRoutes);

// Also mount with /api prefix for backwards compatibility
app.use("/api/users", userRoutes);
app.use("/api/admins", adminRoutes);
app.use("/api/admins/users", adminUserRoutes);
app.use("/api/stations", stationRoutes);
app.use("/api/slots", slotRoutes);
app.use("/api/bookings/user", bookingUserRoutes);   
app.use("/api/bookings/admin", bookingAdminRoutes); 

// Catch-all for invalid endpoints
app.use((req, res) => {
  res.status(404).json({ message: "Endpoint not found" });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
