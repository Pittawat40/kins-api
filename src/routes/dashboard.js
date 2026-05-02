// src/routes/dashboard.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/dashboardController");
const { authenticate } = require("../middleware/auth");
const { postImgUpload } = require("../middleware/upload");

// Public
router.get("/items", ctrl.listItems);
router.get("/items/:id", ctrl.getItem);

// Protected
router.post(
  "/items",
  authenticate,
  postImgUpload.single("img"),
  ctrl.createItem,
);
router.put(
  "/items/:id",
  authenticate,
  postImgUpload.single("img"),
  ctrl.updateItem,
);
router.delete("/items/:id", authenticate, ctrl.deleteItem);
router.patch("/items/reorder", authenticate, ctrl.reorderItems);

module.exports = router;
