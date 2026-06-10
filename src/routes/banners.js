// src/routes/banners.js
const express = require("express");
const router = express.Router({ mergeParams: true });
const ctrl = require("../controllers/bannersController");
const { authenticate } = require("../middleware/auth");
const { validateSection } = require("../middleware/validateSection");
const { bannerUpload, processImage } = require("../middleware/upload");

router.use(validateSection);

// Public
router.get("/", ctrl.listBanners);

// Protected
router.post(
  "/",
  authenticate,
  bannerUpload.single("banner"),
  processImage,
  ctrl.uploadBanner,
);
router.patch("/:id/set-active", authenticate, ctrl.setActiveBanner);
router.delete("/:id", authenticate, ctrl.deleteBanner);

module.exports = router;
