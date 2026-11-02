import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import profileRoutes from "./routes/profileRoutes.js";
import { connectDB, getDB } from "./config/db.js";
import bookRoutes from "./routes/bookRoutes.js";
import borrowRoutes from "./routes/borrowRoutes.js";
import googleBookRoutes from "./routes/googleBookRoutes.js";
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
// Middleware must run before API routes.
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
}));
app.use(express.json());
// Welcome route
app.get("/", (_req, res) => {
    res.json({
        success: true,
        message: "Welcome to BookNook API!",
    });
});
// Health check
app.get("/api/health", async (_req, res) => {
    try {
        await getDB().command({ ping: 1 });
        res.status(200).json({
            success: true,
            message: "BookNook Server and MongoDB are running!",
            database: "Connected",
        });
    }
    catch (error) {
        console.error("Health check failed:", error);
        res.status(500).json({
            success: false,
            message: "Database connection failed",
        });
    }
});
// API Routes
app.use("/books", bookRoutes);
app.use("/borrows", borrowRoutes);
app.use("/google-books", googleBookRoutes);
app.use("/profile", profileRoutes);
// Start Server
async function startServer() {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`MongoDB Connected Successfully!`);
            console.log(`BookNook Server running at http://localhost:${PORT}`);
        });
    }
    catch (error) {
        console.error("Server startup failed:", error);
        process.exit(1);
    }
}
startServer();
