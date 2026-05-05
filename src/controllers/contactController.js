// src/controllers/contactController.js
const db = require("../data/db");

function getContact(req, res) {
  try {
    const row = db.prepare("SELECT * FROM contact WHERE id = 1").get();
    if (!row) {
      return res.json({
        success: true,
        data: { email: "", phones: [], socials: {} },
      });
    }
    res.json({
      success: true,
      data: {
        email: row.email || "",
        phones: JSON.parse(row.phones || "[]"),
        socials: JSON.parse(row.socials || "{}"),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

function updateContact(req, res) {
  const { email = "", phones = [], socials = {} } = req.body;

  // validate socials keys
  const allowedSocials = ["facebook", "instagram", "youtube", "tiktok"];
  const cleanSocials = {};
  allowedSocials.forEach((k) => {
    cleanSocials[k] = (socials[k] || "").trim();
  });

  db.prepare(
    `
    UPDATE contact
    SET email = ?, phones = ?, socials = ?, updatedAt = datetime('now')
    WHERE id = 1
  `,
  ).run(
    (email || "").trim(),
    JSON.stringify(Array.isArray(phones) ? phones : []),
    JSON.stringify(cleanSocials),
  );

  const row = db.prepare("SELECT * FROM contact WHERE id = 1").get();
  return res.json({
    success: true,
    message: "Contact updated",
    data: {
      email: row.email || "",
      phones: JSON.parse(row.phones || "[]"),
      socials: JSON.parse(row.socials || "{}"),
    },
  });
}

module.exports = { getContact, updateContact };
