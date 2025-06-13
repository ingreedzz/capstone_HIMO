import express from "express";
import bcrypt from "bcrypt";
import multer from "multer";
import { supabase } from "../supabaseClient.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    console.log("File filter check:", file.mimetype);
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Add multer error handling middleware right after upload config
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error("Multer error:", error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: error.message });
  }
  
  if (error && error.message === 'Only image files are allowed') {
    return res.status(400).json({ error: 'Only image files are allowed' });
  }
  
  next(error);
};

// PUT route with better error handling
router.put("/", authenticateToken, upload.single("profileImage"), handleMulterError, async (req, res) => {
  console.log("PUT /api/profile called for user:", req.user.user_id);
  console.log("Request body:", req.body);
  console.log("File received:", req.file ? { 
    originalname: req.file.originalname, 
    mimetype: req.file.mimetype, 
    size: req.file.size 
  } : 'No file');

  try {
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("password, img")
      .eq("user_id", req.user.user_id)
      .single();

    if (userError || !user) {
      console.error("User fetch error:", userError?.message || "No user found");
      return res.status(404).json({ error: "User not found" });
    }

    const updates = {};

    // Handle name update
    if (req.body.name) {
      updates.name = req.body.name;
    }

    // Handle password update
    if (req.body.newPassword && req.body.currentPassword) {
      const isValidPassword = await bcrypt.compare(req.body.currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ error: "Invalid current password" });
      }

      const passwordValidation = validatePassword(req.body.newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({ error: passwordValidation.message });
      }

      const isSamePassword = await bcrypt.compare(req.body.newPassword, user.password);
      if (isSamePassword) {
        return res.status(400).json({ error: "New password cannot be the same as the current password" });
      }

      const passwordHash = await bcrypt.hash(req.body.newPassword, 12);
      updates.password = passwordHash;
    }

    // Handle image upload
    if (req.file) {
      try {
        console.log("Processing image upload...");
        
        // Generate unique filename
        const fileExtension = req.file.mimetype.split("/")[1];
        const fileName = `profile-${req.user.user_id}-${Date.now()}.${fileExtension}`;
        
        console.log("Uploading to Supabase storage:", fileName);

        // Upload to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("profile-img")
          .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: true,
          });

        if (uploadError) {
          console.error("Supabase upload error:", uploadError);
          return res.status(500).json({ 
            error: "Failed to upload image to storage", 
            details: uploadError.message 
          });
        }

        console.log("Upload successful:", uploadData);

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("profile-img")
          .getPublicUrl(fileName);

        if (!urlData || !urlData.publicUrl) {
          console.error("Failed to get public URL");
          return res.status(500).json({ error: "Failed to get image URL" });
        }

        updates.img = urlData.publicUrl;
        console.log("Image URL generated:", updates.img);

        // Clean up old image
        if (user.img && user.img.includes('profile-img/')) {
          try {
            const oldFileName = user.img.split('/').pop();
            if (oldFileName && oldFileName !== fileName) {
              const { error: deleteError } = await supabase.storage
                .from("profile-img")
                .remove([oldFileName]);
              
              if (deleteError) {
                console.warn("Failed to delete old image:", deleteError.message);
              } else {
                console.log("Old image deleted:", oldFileName);
              }
            }
          } catch (cleanupError) {
            console.warn("Cleanup error:", cleanupError.message);
          }
        }

      } catch (imageError) {
        console.error("Image processing error:", imageError);
        return res.status(500).json({ 
          error: "Failed to process image", 
          details: imageError.message 
        });
      }
    }

    // Update user in database
    console.log("Updating user with:", updates);
    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update(updates)
      .eq("user_id", req.user.user_id)
      .select("user_id, name, email, img")
      .single();

    if (updateError) {
      console.error("Database update error:", updateError);
      return res.status(500).json({ 
        error: "Failed to update profile in database", 
        details: updateError.message 
      });
    }

    console.log("Profile updated successfully:", updatedUser);

    res.json({
      message: "User profile updated successfully",
      user: {
        user_id: updatedUser.user_id,
        name: updatedUser.name,
        email: updatedUser.email,
        img: updatedUser.img || null,
      },
    });

  } catch (err) {
    console.error("Unexpected error in PUT /api/profile:", {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    res.status(500).json({ 
      error: "Internal server error", 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Please try again later'
    });
  }

// Also fix the GET and DELETE routes
router.get("/", authenticateToken, async (req, res) => {
  console.log("GET /api/profile called with user:", req.user.user_id);
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("user_id, name, email, img")
      .eq("user_id", req.user.user_id)
      .single();

    if (error || !user) {
      console.error("User fetch error:", error?.message || "No user found");
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        img: user.img || null,
      },
    });
  } catch (error) {
    console.error("Error fetching profile:", {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.delete("/", authenticateToken, async (req, res) => {
  console.log("=== DELETE /api/profile called for user:", req.user.user_id);
  try {
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("user_id, img")
      .eq("user_id", req.user.user_id)
      .single();

    if (userError || !user) {
      console.error("User fetch error:", userError?.message || "No user found");
      return res.status(404).json({ error: "User not found" });
    }

    // Delete history records
    const { error: historyError } = await supabase
      .from("history")
      .delete()
      .eq("user_id", req.user.user_id);

    if (historyError) {
      console.error("History delete error:", historyError);
      return res.status(500).json({ error: "Failed to delete history data" });
    }

    // Delete profile image from storage
    if (user.img && user.img.includes('profile-img/')) {
      try {
        const fileName = user.img.split('/').pop();
        if (fileName) {
          await supabase.storage.from("profile-img").remove([fileName]);
        }
      } catch (storageError) {
        console.warn("Storage cleanup error:", storageError);
      }
    }

    // Delete user account
    const { error: userDeleteError } = await supabase
      .from("users")
      .delete()
      .eq("user_id", req.user.user_id);

    if (userDeleteError) {
      console.error("User delete error:", userDeleteError);
      return res.status(500).json({ error: "Failed to delete user account" });
    }

    console.log("Account deleted successfully for user:", req.user.user_id);
    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({ error: "Failed to delete account" });
  }
});


function validatePassword(password) {
  const minLength = 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength || !(hasLetter && hasNumber && hasSymbol)) {
    return {
      isValid: false,
      message: "Password must be at least 8 characters long and include a mix of letters, numbers, and symbols.",
    };
  }
  return { isValid: true, message: "" };
}

// Add this middleware after your routes to handle multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: error.message });
  }
  
  if (error.message === 'Only image files are allowed') {
    return res.status(400).json({ error: 'Only image files are allowed' });
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

function validatePassword(password) {
  const minLength = 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength || !(hasLetter && hasNumber && hasSymbol)) {
    return {
      isValid: false,
      message: "Password must be at least 8 characters long and include a mix of letters, numbers, and symbols.",
    };
  }
  return { isValid: true, message: "" };
}

export default router;