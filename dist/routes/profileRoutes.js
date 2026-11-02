import { Router } from "express";
import multer from "multer";
import { Readable } from "stream";
import { v2 as cloudinary } from "cloudinary";
import { getDB } from "../config/db.js";
import { verifyToken } from "../middleware/authMiddleware.js";
const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (_req, file, callback) => {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
        ];
        if (!allowedTypes.includes(file.mimetype)) {
            callback(new Error("Only JPG, PNG and WebP images are allowed."));
            return;
        }
        callback(null, true);
    },
});
function configureCloudinary() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error("Cloudinary credentials are missing.");
    }
    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
    });
}
function uploadImage(buffer) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
            folder: "booknook/profiles",
            resource_type: "image",
            allowed_formats: ["jpg", "jpeg", "png", "webp"],
        }, (error, result) => {
            if (error || !result) {
                reject(error || new Error("Image upload failed."));
                return;
            }
            resolve({
                secure_url: result.secure_url,
                public_id: result.public_id,
            });
        });
        Readable.from(buffer).pipe(stream);
    });
}
// GET: Current user's custom profile picture
router.get("/", verifyToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized.",
            });
            return;
        }
        const profile = await getDB()
            .collection("profileImages")
            .findOne({ userId });
        res.status(200).json({
            success: true,
            data: profile,
        });
    }
    catch (error) {
        console.error("Profile fetch error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to load profile picture.",
        });
    }
});
// POST: Upload or replace custom profile picture
router.post("/avatar", verifyToken, upload.single("avatar"), async (req, res) => {
    let uploadedPublicId;
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized.",
            });
            return;
        }
        if (!req.file) {
            res.status(400).json({
                success: false,
                message: "Please select a profile picture.",
            });
            return;
        }
        configureCloudinary();
        const collection = getDB().collection("profileImages");
        const oldProfile = await collection.findOne({ userId });
        const uploaded = await uploadImage(req.file.buffer);
        uploadedPublicId = uploaded.public_id;
        const newProfile = {
            userId,
            imageUrl: uploaded.secure_url,
            publicId: uploaded.public_id,
            updatedAt: new Date(),
        };
        await collection.updateOne({ userId }, { $set: newProfile }, { upsert: true });
        // Delete previous custom image after successful replacement
        if (oldProfile?.publicId) {
            await cloudinary.uploader.destroy(oldProfile.publicId);
        }
        res.status(200).json({
            success: true,
            message: "Profile picture updated successfully.",
            data: newProfile,
        });
    }
    catch (error) {
        // Remove newly uploaded image if saving failed
        if (uploadedPublicId) {
            try {
                configureCloudinary();
                await cloudinary.uploader.destroy(uploadedPublicId);
            }
            catch (deleteError) {
                console.error("Cloudinary cleanup error:", deleteError);
            }
        }
        console.error("Profile upload error:", error);
        res.status(500).json({
            success: false,
            message: "Profile picture upload failed.",
        });
    }
});
// DELETE: Remove custom profile picture
router.delete("/avatar", verifyToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized.",
            });
            return;
        }
        configureCloudinary();
        const collection = getDB().collection("profileImages");
        const profile = await collection.findOne({ userId });
        if (!profile) {
            res.status(404).json({
                success: false,
                message: "No custom profile picture found.",
            });
            return;
        }
        if (profile.publicId) {
            await cloudinary.uploader.destroy(profile.publicId);
        }
        await collection.deleteOne({ userId });
        res.status(200).json({
            success: true,
            message: "Custom profile picture removed successfully.",
        });
    }
    catch (error) {
        console.error("Profile delete error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to remove profile picture.",
        });
    }
});
export default router;
