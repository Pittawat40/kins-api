// src/routes/ads.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/adsController");
const { authenticate } = require("../middleware/auth");
const { createUploader } = require("../middleware/upload");

const adImgUpload = createUploader("ads");

// Public
router.get("/", ctrl.listAds);
router.post("/:id/click", ctrl.trackAds);

// Protected
router.post("/", authenticate, adImgUpload.single("img"), ctrl.createAd);
router.put("/:id", authenticate, adImgUpload.single("img"), ctrl.updateAd);
router.delete("/:id", authenticate, ctrl.deleteAd);

module.exports = router;
