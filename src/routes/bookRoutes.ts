
import { Router, Request, Response } from "express";
import { ObjectId } from "mongodb";

import { getDB } from "../config/db.js";
import { Book } from "../types/book.js";
import { Borrow } from "../types/borrow.js";
import {
  verifyToken,
  AuthenticatedRequest,
} from "../middleware/authMiddleware.js";

const router = Router();

const BOOK_COLLECTION = "books";
const BORROW_COLLECTION = "borrows";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ==========================================
// GET: Get all books
// ==========================================

router.get("/", async (req: Request, res: Response) => {
  try {
    const db = getDB();

    const search = req.query.search?.toString().trim() || "";
    const category = req.query.category?.toString().trim() || "";
    const rawLimit = Number(req.query.limit);

    const filter: Record<string, unknown> = {};

    if (search) {
      const safeSearch = escapeRegex(search);

      filter.$or = [
        { title: { $regex: safeSearch, $options: "i" } },
        { author: { $regex: safeSearch, $options: "i" } },
      ];
    }

    if (category) {
      filter.category = category;
    }

    let query = db
      .collection<Book>(BOOK_COLLECTION)
      .find(filter)
      .sort({ createdAt: -1 });

    if (Number.isFinite(rawLimit) && rawLimit > 0) {
      query = query.limit(Math.min(Math.floor(rawLimit), 100));
    }

    const books = await query.toArray();

    res.status(200).json({
      success: true,
      count: books.length,
      data: books,
    });
  } catch (error) {
    console.error("Get Books Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch books",
    });
  }
});

// ==========================================
// GET: Get a single book
// ==========================================

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);

    if (!ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid book ID",
      });
      return;
    }

    const db = getDB();

    const book = await db.collection<Book>(BOOK_COLLECTION).findOne({
      _id: new ObjectId(id),
    });

    if (!book) {
      res.status(404).json({
        success: false,
        message: "Book not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: book,
    });
  } catch (error) {
    console.error("Get Single Book Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch book",
    });
  }
});

// ==========================================
// POST: Add a new book (JWT Protected)
// ==========================================

router.post(
  "/",
  verifyToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getDB();

      const {
        title,
        author,
        category,
        description,
        image,
        totalCopies,
      } = req.body;

      if (
        typeof title !== "string" ||
        !title.trim() ||
        typeof author !== "string" ||
        !author.trim() ||
        typeof category !== "string" ||
        !category.trim() ||
        typeof description !== "string" ||
        !description.trim() ||
        typeof image !== "string" ||
        !image.trim() ||
        !Number.isInteger(Number(totalCopies)) ||
        Number(totalCopies) < 1
      ) {
        res.status(400).json({
          success: false,
          message: "Please provide all required book information",
        });
        return;
      }

      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "User authentication required",
        });
        return;
      }

      const newBook: Book = {
        title: title.trim(),
        author: author.trim(),
        category: category.trim(),
        description: description.trim(),
        image: image.trim(),
        totalCopies: Number(totalCopies),
        availableCopies: Number(totalCopies),
        addedBy: req.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db
        .collection<Book>(BOOK_COLLECTION)
        .insertOne(newBook);

      res.status(201).json({
        success: true,
        message: "Book added successfully",
        data: {
          ...newBook,
          _id: result.insertedId,
        },
      });
    } catch (error) {
      console.error("Add Book Error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to add book",
      });
    }
  }
);

// ==========================================
// PATCH: Update a book (Owner Only)
// ==========================================

router.patch(
  "/:id",
  verifyToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = String(req.params.id);

      if (!ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid book ID",
        });
        return;
      }

      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "User authentication required",
        });
        return;
      }

      const db = getDB();
      const collection = db.collection<Book>(BOOK_COLLECTION);

      const existingBook = await collection.findOne({
        _id: new ObjectId(id),
        addedBy: req.user.id,
      });

      if (!existingBook) {
        res.status(404).json({
          success: false,
          message: "Book not found or you are not the owner",
        });
        return;
      }

      const {
        title,
        author,
        category,
        description,
        image,
        totalCopies,
      } = req.body;

      const updates: Partial<Book> = {};

      if (title !== undefined) {
        if (typeof title !== "string" || !title.trim()) {
          res.status(400).json({
            success: false,
            message: "Invalid book title",
          });
          return;
        }
        updates.title = title.trim();
      }

      if (author !== undefined) {
        if (typeof author !== "string" || !author.trim()) {
          res.status(400).json({
            success: false,
            message: "Invalid author name",
          });
          return;
        }
        updates.author = author.trim();
      }

      if (category !== undefined) {
        if (typeof category !== "string" || !category.trim()) {
          res.status(400).json({
            success: false,
            message: "Invalid category",
          });
          return;
        }
        updates.category = category.trim();
      }

      if (description !== undefined) {
        if (typeof description !== "string" || !description.trim()) {
          res.status(400).json({
            success: false,
            message: "Invalid description",
          });
          return;
        }
        updates.description = description.trim();
      }

      if (image !== undefined) {
        if (typeof image !== "string" || !image.trim()) {
          res.status(400).json({
            success: false,
            message: "Invalid image URL",
          });
          return;
        }
        updates.image = image.trim();
      }

      if (totalCopies !== undefined) {
        const newTotal = Number(totalCopies);

        if (!Number.isInteger(newTotal) || newTotal < 1) {
          res.status(400).json({
            success: false,
            message: "Total copies must be a positive integer",
          });
          return;
        }

        const borrowedCopies =
          existingBook.totalCopies - existingBook.availableCopies;

        if (newTotal < borrowedCopies) {
          res.status(400).json({
            success: false,
            message: "Total copies cannot be less than borrowed copies",
          });
          return;
        }

        updates.totalCopies = newTotal;
        updates.availableCopies = newTotal - borrowedCopies;
      }

      if (Object.keys(updates).length === 0) {
        res.status(400).json({
          success: false,
          message: "No valid fields provided for update",
        });
        return;
      }

      updates.updatedAt = new Date();

      await collection.updateOne(
        {
          _id: new ObjectId(id),
          addedBy: req.user.id,
        },
        {
          $set: updates,
        }
      );

      const updatedBook = await collection.findOne({
        _id: new ObjectId(id),
      });

      res.status(200).json({
        success: true,
        message: "Book updated successfully",
        data: updatedBook,
      });
    } catch (error) {
      console.error("Update Book Error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to update book",
      });
    }
  }
);

// ==========================================
// DELETE: Delete a book (Owner Only)
// ==========================================

router.delete(
  "/:id",
  verifyToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = String(req.params.id);

      if (!ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid book ID",
        });
        return;
      }

      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "User authentication required",
        });
        return;
      }

      const db = getDB();
      const bookId = new ObjectId(id);

      const existingBook = await db
        .collection<Book>(BOOK_COLLECTION)
        .findOne({
          _id: bookId,
          addedBy: req.user.id,
        });

      if (!existingBook) {
        res.status(404).json({
          success: false,
          message: "Book not found or you are not the owner",
        });
        return;
      }

      const activeBorrow = await db
        .collection<Borrow>(BORROW_COLLECTION)
        .findOne({
          bookId,
          status: "active",
        });

      if (activeBorrow) {
        res.status(409).json({
          success: false,
          message: "This book cannot be deleted while it has active borrows",
        });
        return;
      }

      const result = await db
        .collection<Book>(BOOK_COLLECTION)
        .deleteOne({
          _id: bookId,
          addedBy: req.user.id,
        });

      if (result.deletedCount === 0) {
        res.status(404).json({
          success: false,
          message: "Book not found or you are not the owner",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Book deleted successfully",
      });
    } catch (error) {
      console.error("Delete Book Error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to delete book",
      });
    }
  }
);

export default router;
