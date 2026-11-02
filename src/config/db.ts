
import { MongoClient, type Db } from "mongodb";

let database: Db | undefined;
let mongoClient: MongoClient | undefined;
let connectionPromise: Promise<void> | undefined;

export async function connectDB(): Promise<void> {
  // Prevent duplicate connections
  if (database && mongoClient) {
    console.log("MongoDB is already connected.");
    return;
  }

  // Reuse an ongoing connection attempt
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error("MONGODB_URI is missing from .env file");
    }

    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    try {
      await client.connect();

      const db = client.db("booknook");

      // Verify database connection
      await db.command({ ping: 1 });

      // Prevent the same user from borrowing
      // the same book more than once simultaneously
      await db.collection("borrows").createIndex(
        {
          bookId: 1,
          userId: 1,
        },
        {
          unique: true,
          partialFilterExpression: {
            status: "active",
          },
          name: "unique_active_borrow_per_user",
        }
      );

      // Save connection only after successful setup
      mongoClient = client;
      database = db;

      console.log("MongoDB Connected Successfully!");
    } catch (error) {
      await client.close().catch(() => undefined);

      console.error("MongoDB Connection Failed:", error);

      throw error;
    }
  })();

  try {
    await connectionPromise;
  } finally {
    connectionPromise = undefined;
  }
}

export function getDB(): Db {
  if (!database) {
    throw new Error("Database is not connected yet!");
  }

  return database;
}

export function getMongoClient(): MongoClient {
  if (!mongoClient) {
    throw new Error("MongoDB client is not connected yet!");
  }

  return mongoClient;
}
