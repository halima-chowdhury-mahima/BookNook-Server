
import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

interface GoogleBookItem {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
    categories?: string[];
    pageCount?: number;
    language?: string;
    previewLink?: string;
    infoLink?: string;
    industryIdentifiers?: Array<{
      type: string;
      identifier: string;
    }>;
  };
}

interface GoogleBooksResponse {
  items?: GoogleBookItem[];
  totalItems?: number;
  error?: {
    message?: string;
    status?: string;
  };
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const query = typeof req.query.q === "string"
      ? req.query.q.trim()
      : "";

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Please provide a book search query.",
      });
    }

    if (query.length > 200) {
      return res.status(400).json({
        success: false,
        message: "Search query must not exceed 200 characters.",
      });
    }

    const rawMaxResults = req.query.maxResults;
    const requestedMaxResults =
      rawMaxResults === undefined ? 12 : Number(rawMaxResults);

    if (!Number.isInteger(requestedMaxResults)) {
      return res.status(400).json({
        success: false,
        message: "maxResults must be a valid integer.",
      });
    }

    const maxResults = Math.min(
      Math.max(requestedMaxResults, 1),
      40
    );

    const rawStartIndex = req.query.startIndex;
    const startIndex =
      rawStartIndex === undefined ? 0 : Number(rawStartIndex);

    if (
      !Number.isSafeInteger(startIndex) ||
      startIndex < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "startIndex must be a non-negative integer.",
      });
    }

    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

    if (!apiKey) {
      console.error("GOOGLE_BOOKS_API_KEY is missing.");

      return res.status(500).json({
        success: false,
        message: "Google Books API key is not configured.",
      });
    }

    const params = new URLSearchParams({
      q: query,
      maxResults: String(maxResults),
      startIndex: String(startIndex),
      printType: "books",
      key: apiKey,
    });

    const googleResponse = await fetch(
      `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
      {
        signal: AbortSignal.timeout(10000),
      }
    );

    let googleData: GoogleBooksResponse;

    try {
      googleData = await googleResponse.json() as GoogleBooksResponse;
    } catch {
      console.error("Google Books returned invalid JSON.");

      return res.status(502).json({
        success: false,
        message: "Google Books returned an invalid response.",
      });
    }

    if (!googleResponse.ok) {
      console.error("Google Books API failed:", {
        status: googleResponse.status,
        message: googleData.error?.message || "Unknown API error",
      });

      return res.status(502).json({
        success: false,
        message: "Google Books search failed. Please try again.",
      });
    }

    const books = (googleData.items || []).map((item) => {
      const info = item.volumeInfo || {};

      const image =
        info.imageLinks?.thumbnail ||
        info.imageLinks?.smallThumbnail ||
        "";

      return {
        id: item.id,
        title: info.title || "Untitled",
        authors: info.authors || ["Unknown Author"],
        publisher: info.publisher || "Unknown Publisher",
        publishedDate: info.publishedDate || "",
        description: info.description || "No description available.",
        image: image.replace(/^http:\/\//i, "https://"),
        categories: info.categories || [],
        pageCount: info.pageCount || null,
        language: info.language || "",
        previewLink: info.previewLink || "",
        infoLink: info.infoLink || "",
        identifiers: info.industryIdentifiers || [],
      };
    });

    return res.status(200).json({
      success: true,
      totalItems: googleData.totalItems || 0,
      books,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "TimeoutError"
    ) {
      return res.status(504).json({
        success: false,
        message: "Google Books request timed out. Please try again.",
      });
    }

    console.error("Google Books API Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to search books right now.",
    });
  }
});

export default router;
