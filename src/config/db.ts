
import { MongoClient, Db } from "mongodb";

let database: Db;
let mongoClient: MongoClient;

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing from .env file");
  }

  mongoClient = new MongoClient(uri);

  await mongoClient.connect();

  database = mongoClient.db("booknook");

  await database.command({ ping: 1 });

  await database.collection("borrows").createIndex(
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

  console.log("MongoDB Connected Successfully!");
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
