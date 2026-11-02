
import { Router, Response } from "express";
import { ObjectId } from "mongodb";

import { getDB, getMongoClient } from "../config/db.js";
import { Book } from "../types/book.js";
import { Borrow } from "../types/borrow.js";
import {
  verifyToken,
  AuthenticatedRequest,
} from "../middleware/authMiddleware.js";

const router = Router();

// ==========================================
// POST: Borrow a book (JWT Protected)
// ==========================================

router.post(
  "/",
  verifyToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const session = getMongoClient().startSession();

    try {
      const { bookId } = req.body;

      if (!bookId || !ObjectId.isValid(bookId)) {
        res.status(400).json({
          success: false,
          message: "A valid book ID is required",
        });
        return;
      }

      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const db = getDB();
      const books = db.collection<Book>("books");
      const borrows = db.collection<Borrow>("borrows");

      let createdBorrow: Borrow | null = null;

      await session.withTransaction(async () => {
        const objectBookId = new ObjectId(bookId);

        // Check whether the book exists
        const book = await books.findOne(
          { _id: objectBookId },
          { session }
        );

        if (!book) {
          throw new Error("BOOK_NOT_FOUND");
        }

        // Atomically decrease available copies
        const stockResult = await books.updateOne(
          {
            _id: objectBookId,
            availableCopies: { $gt: 0 },
          },
          {
            $inc: { availableCopies: -1 },
            $set: { updatedAt: new Date() },
          },
          { session }
        );

        if (stockResult.modifiedCount !== 1) {
          throw new Error("BOOK_UNAVAILABLE");
        }

        const borrowRecord: Borrow = {
          bookId: objectBookId,
          userId: req.user!.id,
          bookTitle: book.title,
          bookAuthor: book.author,
          bookImage: book.image,
          borrowedAt: new Date(),
          status: "active",
        };

        // Save borrow record
        const result = await borrows.insertOne(
          borrowRecord,
          { session }
        );

        createdBorrow = {
          ...borrowRecord,
          _id: result.insertedId,
        };
      });

      res.status(201).json({
        success: true,
        message: "Book borrowed successfully",
        data: createdBorrow,
      });
    } catch (error) {
      console.error("Borrow Book Error:", error);

      if (
        error instanceof Error &&
        error.message === "BOOK_NOT_FOUND"
      ) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        });
        return;
      }

      if (
        error instanceof Error &&
        error.message === "BOOK_UNAVAILABLE"
      ) {
        res.status(400).json({
          success: false,
          message: "This book is currently not available",
        });
        return;
      }

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        res.status(409).json({
          success: false,
          message: "You have already borrowed this book",
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Failed to borrow book",
      });
    } finally {
      await session.endSession();
    }
  }
);

// ==========================================
// GET: Get logged-in user's borrow history
// ==========================================

router.get(
  "/",
  verifyToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const db = getDB();

      const borrows = await db
        .collection<Borrow>("borrows")
        .find({
          userId: req.user.id,
        })
        .sort({ borrowedAt: -1 })
        .toArray();

      res.status(200).json({
        success: true,
        count: borrows.length,
        data: borrows,
      });
    } catch (error) {
      console.error("Get Borrow History Error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to fetch borrow history",
      });
    }
  }
);

// ==========================================
// DELETE: Return a borrowed book
// ==========================================

router.delete(
  "/:id",
  verifyToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const session = getMongoClient().startSession();

    try {
      const borrowId = String(req.params.id);

      if (!ObjectId.isValid(borrowId)) {
        res.status(400).json({
          success: false,
          message: "Invalid borrow ID",
        });
        return;
      }

      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const db = getDB();
      const borrows = db.collection<Borrow>("borrows");
      const books = db.collection<Book>("books");

      await session.withTransaction(async () => {
        // Find only this user's active borrow
        const borrow = await borrows.findOne(
          {
            _id: new ObjectId(borrowId),
            userId: req.user!.id,
            status: "active",
          },
          { session }
        );

        if (!borrow) {
          throw new Error("BORROW_NOT_FOUND");
        }

        // Mark borrow as returned
        const returnResult = await borrows.updateOne(
          {
            _id: borrow._id,
            userId: req.user!.id,
            status: "active",
          },
          {
            $set: {
              status: "returned",
              returnedAt: new Date(),
            },
          },
          { session }
        );

        if (returnResult.modifiedCount !== 1) {
          throw new Error("RETURN_FAILED");
        }

        // Increase available copies
        const stockResult = await books.updateOne(
          { _id: borrow.bookId },
          {
            $inc: { availableCopies: 1 },
            $set: { updatedAt: new Date() },
          },
          { session }
        );

        if (stockResult.matchedCount !== 1) {
          throw new Error("BOOK_NOT_FOUND");
        }
      });

      res.status(200).json({
        success: true,
        message: "Book returned successfully",
      });
    } catch (error) {
      console.error("Return Book Error:", error);

      if (
        error instanceof Error &&
        error.message === "BORROW_NOT_FOUND"
      ) {
        res.status(404).json({
          success: false,
          message: "Active borrow record not found",
        });
        return;
      }

      if (
        error instanceof Error &&
        error.message === "BOOK_NOT_FOUND"
      ) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Failed to return book",
      });
    } finally {
      await session.endSession();
    }
  }
);

export default router;
