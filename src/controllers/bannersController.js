// src/controllers/bannersController.js
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const db = require("../data/db");

function fmtBanner(row) {
  return { ...row, active: row.active === 1 };
}

// GET /api/:section/banners
function listBanners(req, res) {
  const { section } = req.params;

  const order =
    section === "dashboard"
      ? "sortOrder ASC, createdAt DESC"
      : "createdAt DESC";

  const rows = db
    .prepare(
      `SELECT * FROM banners 
       WHERE section = ? 
       ORDER BY ${order}`,
    )
    .all(section);

  return res.json({
    success: true,
    data: rows.map(fmtBanner),
  });
}

// POST /api/:section/banners  (multipart/form-data  field: banner)
function uploadBanner(req, res) {
  const { section } = req.params;
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded. Field name must be "banner"',
    });
  }

  const isFirst =
    db
      .prepare("SELECT COUNT(*) as c FROM banners WHERE section = ?")
      .get(section).c === 0;
  const id = uuidv4();
  const now = new Date().toISOString();
  const isVideo = req.file.mimetype.startsWith("video");

  db.prepare(
    `
    INSERT INTO banners (id, section, filename, originalName, url, type, size, active, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    section,
    req.file.filename,
    req.file.originalname,
    `/uploads/banners/${req.file.filename}`,
    isVideo ? "video" : "image",
    req.file.size,
    isFirst ? 1 : 0,
    now,
  );

  const row = db.prepare("SELECT * FROM banners WHERE id = ?").get(id);
  return res
    .status(201)
    .json({ success: true, message: "Banner uploaded", data: fmtBanner(row) });
}

// PATCH /api/:section/banners/:id/set-active
function setActiveBanner(req, res) {
  const { section, id } = req.params;
  const target = db
    .prepare("SELECT * FROM banners WHERE section = ? AND id = ?")
    .get(section, id);
  if (!target)
    return res
      .status(404)
      .json({ success: false, message: "Banner not found" });

  db.transaction(() => {
    db.prepare("UPDATE banners SET active = 0 WHERE section = ?").run(section);
    db.prepare("UPDATE banners SET active = 1 WHERE id = ?").run(id);
  })();

  return res.json({
    success: true,
    message: "Active banner set",
    data: fmtBanner({ ...target, active: 1 }),
  });
}

// DELETE /api/:section/banners/:id
function deleteBanner(req, res) {
  const { section, id } = req.params;
  const row = db
    .prepare("SELECT * FROM banners WHERE section = ? AND id = ?")
    .get(section, id);
  if (!row)
    return res
      .status(404)
      .json({ success: false, message: "Banner not found" });

  db.prepare("DELETE FROM banners WHERE id = ?").run(id);

  const filePath = path.join(process.cwd(), "uploads", "banners", row.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  if (row.active) {
    const next = db
      .prepare(
        "SELECT id FROM banners WHERE section = ? ORDER BY createdAt DESC LIMIT 1",
      )
      .get(section);
    if (next)
      db.prepare("UPDATE banners SET active = 1 WHERE id = ?").run(next.id);
  }

  return res.json({ success: true, message: "Banner deleted" });
}

module.exports = { listBanners, uploadBanner, setActiveBanner, deleteBanner };
