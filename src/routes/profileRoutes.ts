
import {
  Router,
  Request,
  Response,
  NextFunction,
} from "express";
import multer from "multer";
import { Readable } from "stream";
import { v2 as cloudinary } from "cloudinary";

import { getDB } from "../config/db.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = Router();

interface ProfileImage {
  userId: string;
  imageUrl: string;
  publicId: string;
  updatedAt: Date;
}

// Multer configuration
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
      callback(
        new Error("Only JPG, PNG and WebP images are allowed.")
      );
      return;
    }

    callback(null, true);
  },
});

// Handle Multer errors before reaching the upload route
function handleAvatarUpload(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  upload.single("avatar")(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "Image size must not exceed 5MB."
          : "Invalid image upload.";

      res.status(400).json({
        success: false,
        message,
      });

      return;
    }

    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Invalid image upload.",
    });
  });
}

// Configure Cloudinary
function configureCloudinary(): void {
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

// Upload image to Cloudinary
function uploadImage(
  buffer: Buffer
): Promise<{
  secure_url: string;
  public_id: string;
}> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "booknook/profiles",
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Image upload failed."));
          return;
        }

        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );

    const readable = Readable.from([buffer]);

    readable.on("error", reject);
    uploadStream.on("error", reject);

    readable.pipe(uploadStream);
  });
}

// GET: Current user's custom profile picture
router.get(
  "/",
  verifyToken,
  async (req: Request, res: Response) => {
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
        .collection<ProfileImage>("profileImages")
        .findOne({ userId });

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      console.error("Profile fetch error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to load profile picture.",
      });
    }
  }
);

// POST: Upload or replace custom profile picture
router.post(
  "/avatar",
  verifyToken,
  handleAvatarUpload,
  async (req: Request, res: Response) => {
    let uploadedPublicId: string | undefined;
    let profileSaved = false;

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

      const collection =
        getDB().collection<ProfileImage>("profileImages");

      const oldProfile = await collection.findOne({ userId });

      const uploaded = await uploadImage(req.file.buffer);

      uploadedPublicId = uploaded.public_id;

      const newProfile: ProfileImage = {
        userId,
        imageUrl: uploaded.secure_url,
        publicId: uploaded.public_id,
        updatedAt: new Date(),
      };

      await collection.updateOne(
        { userId },
        { $set: newProfile },
        { upsert: true }
      );

      // Database successfully saved the new image
      profileSaved = true;

      // Delete old image without affecting the new image
      if (
        oldProfile?.publicId &&
        oldProfile.publicId !== uploaded.public_id
      ) {
        try {
          await cloudinary.uploader.destroy(oldProfile.publicId);
        } catch (deleteError) {
          console.error(
            "Old profile image cleanup error:",
            deleteError
          );
        }
      }

      res.status(200).json({
        success: true,
        message: "Profile picture updated successfully.",
        data: newProfile,
      });
    } catch (error) {
      // Clean up the new image only if database saving failed
      if (uploadedPublicId && !profileSaved) {
        try {
          configureCloudinary();
          await cloudinary.uploader.destroy(uploadedPublicId);
        } catch (deleteError) {
          console.error(
            "Cloudinary cleanup error:",
            deleteError
          );
        }
      }

      console.error("Profile upload error:", error);

      res.status(500).json({
        success: false,
        message: "Profile picture upload failed.",
      });
    }
  }
);

// DELETE: Remove custom profile picture
router.delete(
  "/avatar",
  verifyToken,
  async (req: Request, res: Response) => {
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

      const collection =
        getDB().collection<ProfileImage>("profileImages");

      const profile = await collection.findOne({ userId });

      if (!profile) {
        res.status(404).json({
          success: false,
          message: "No custom profile picture found.",
        });
        return;
      }

      // Remove database reference first
      await collection.deleteOne({ userId });

      // Cloudinary cleanup is best-effort
      if (profile.publicId) {
        try {
          await cloudinary.uploader.destroy(profile.publicId);
        } catch (deleteError) {
          console.error(
            "Cloudinary image deletion error:",
            deleteError
          );
        }
      }

      res.status(200).json({
        success: true,
        message: "Custom profile picture removed successfully.",
      });
    } catch (error) {
      console.error("Profile delete error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to remove profile picture.",
      });
    }
  }
);

export default router;
