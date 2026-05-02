// src/routes/posts.js
const express = require("express");
const router = express.Router({ mergeParams: true });
const ctrl = require("../controllers/postsController");
const { authenticate } = require("../middleware/auth");
const { validateSection } = require("../middleware/validateSection");
const { postImgUpload } = require("../middleware/upload");

router.use(validateSection);

// Public
router.get("/", ctrl.listPosts);
router.get("/slug/:slug", ctrl.getPostBySlug);
router.get("/:id", ctrl.getPost);

// Protected — standalone image upload (returns URL only, no post created)
router.post("/upload-image", authenticate, postImgUpload.single("img"), ctrl.uploadImage);

// Protected — create/update accept JSON body (img field = URL string)
router.post("/", authenticate, ctrl.createPost);
router.put("/:id", authenticate, ctrl.updatePost);
router.delete("/bulk", authenticate, ctrl.bulkDelete);
router.patch("/bulk-status", authenticate, ctrl.bulkStatus);
router.delete("/:id", authenticate, ctrl.deletePost);

module.exports = router;
