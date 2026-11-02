import { Router } from "express";
const router = Router();
router.get("/", async (req, res) => {
    try {
        const query = String(req.query.q || "").trim();
        if (!query) {
            return res.status(400).json({
                success: false,
                message: "Please provide a book search query.",
            });
        }
        const maxResults = Math.min(Math.max(Number(req.query.maxResults) || 12, 1), 40);
        const startIndex = Math.max(Number(req.query.startIndex) || 0, 0);
        const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
        if (!apiKey) {
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
        const googleResponse = await fetch(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`);
        if (!googleResponse.ok) {
            return res.status(googleResponse.status).json({
                success: false,
                message: "Google Books search failed.",
            });
        }
        const googleData = await googleResponse.json();
        const books = (googleData.items || []).map((item) => {
            const info = item.volumeInfo || {};
            return {
                id: item.id,
                title: info.title || "Untitled",
                authors: info.authors || ["Unknown Author"],
                publisher: info.publisher || "Unknown Publisher",
                publishedDate: info.publishedDate || "",
                description: info.description || "No description available.",
                image: info.imageLinks?.thumbnail?.replace("http://", "https://") ||
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
    }
    catch (error) {
        console.error("Google Books API Error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to search books right now.",
        });
    }
});
export default router;
