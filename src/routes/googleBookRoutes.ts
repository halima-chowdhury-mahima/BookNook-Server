
import { Router, Request, Response } from "express";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const query = String(req.query.q || "").trim();

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Please provide a book search query.",
      });
    }

    const maxResults = Math.min(
      Math.max(Number(req.query.maxResults) || 12, 1),
      40
    );

    const startIndex = Math.max(
      Number(req.query.startIndex) || 0,
      0
    );

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
      `https://www.googleapis.com/books/v1/volumes?${params.toString()}`
    );

    const responseText = await googleResponse.text();

    let googleData: {
      items?: Array<{
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
      }>;
      totalItems?: number;
      error?: {
        code?: number;
        message?: string;
        status?: string;
      };
    };

    try {
      googleData = JSON.parse(responseText);
    } catch {
      console.error(
        "Google Books returned an invalid response:",
        googleResponse.status
      );

      return res.status(502).json({
        success: false,
        message: "Google Books returned an invalid response.",
      });
    }

    if (!googleResponse.ok) {
      console.error("Google Books API failed:", {
        status: googleResponse.status,
        message: googleData.error?.message || "Unknown Google API error",
        reason: googleData.error?.status || "Unknown",
      });

      return res.status(502).json({
        success: false,
        message:
          googleData.error?.message || "Google Books search failed.",
        status: googleResponse.status,
      });
    }

    const books = (googleData.items || []).map((item) => {
      const info = item.volumeInfo || {};

      return {
        id: item.id,
        title: info.title || "Untitled",
        authors: info.authors || ["Unknown Author"],
        publisher: info.publisher || "Unknown Publisher",
        publishedDate: info.publishedDate || "",
        description: info.description || "No description available.",
        image:
          info.imageLinks?.thumbnail?.replace("http://", "https://") ||
          info.imageLinks?.smallThumbnail?.replace("http://", "https://") ||
          "",
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
    console.error("Google Books API Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to search books right now.",
    });
  }
});

export default router;
