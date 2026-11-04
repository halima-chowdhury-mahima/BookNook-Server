
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDB, getDB } from "./config/db.js";

import profileRoutes from "./routes/profileRoutes.js";
import bookRoutes from "./routes/bookRoutes.js";
import borrowRoutes from "./routes/borrowRoutes.js";
import googleBookRoutes from "./routes/googleBookRoutes.js";

dotenv.config();

const app = express();

// ==========================================
// MIDDLEWARE
// ==========================================

const allowedOrigins = [
  "http://localhost:3000",
  ...(process.env.CLIENT_URL || "")
    .split(",")
    .map((url) => url.trim().replace(/\/$/, ""))
    .filter(Boolean),
];

// CORS Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      const normalizedOrigin = origin?.replace(/\/$/, "");

      if (!origin || allowedOrigins.includes(normalizedOrigin!)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
  })
);

// IMPORTANT: Parse JSON and URL-encoded request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// WELCOME ROUTE
// ==========================================

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Welcome to BookNook API!",
  });
});

// ==========================================
// DATABASE CONNECTION
// ==========================================

app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/health", async (_req, res) => {
  try {
    await getDB().command({ ping: 1 });

    res.status(200).json({
      success: true,
      message: "BookNook Server and MongoDB are running!",
      database: "Connected",
    });
  } catch (error) {
    console.error("Health check failed:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

// ==========================================
// API ROUTES
// ==========================================

app.use("/books", bookRoutes);
app.use("/borrows", borrowRoutes);
app.use("/google-books", googleBookRoutes);
app.use("/profile", profileRoutes);

// ==========================================
// EXPORT EXPRESS APP FOR VERCEL
// ==========================================

export default app;
