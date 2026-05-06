// src/middleware/validateSection.js
const SECTIONS = [
  "hotels",
  "realestate",
  "travel",
  "lifestyle",
  "dashboard",
  "ads",
];

function validateSection(req, res, next) {
  const { section } = req.params;
  if (!SECTIONS.includes(section)) {
    return res.status(400).json({
      success: false,
      message: `Invalid section. Must be one of: ${SECTIONS.join(", ")}`,
    });
  }
  next();
}

module.exports = { validateSection };
