
import app from "./server.js";
import { connectDB } from "./config/db.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    console.log("MongoDB Connected Successfully!");

    app.listen(PORT, () => {
      console.log(`BookNook Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start BookNook Server:", error);
    process.exit(1);
  }
};

startServer();
