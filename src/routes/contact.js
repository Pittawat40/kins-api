// src/routes/contact.js
const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/contactController");

router.get("/contact", ctrl.getContact);
router.put("/contact", ctrl.updateContact);

module.exports = router;
