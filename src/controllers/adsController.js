// src/controllers/adsController.js
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const db = require("../data/db");

// ── Migration ────────────────────────────────────────

function deleteLocalImg(imgUrl) {
  if (!imgUrl || !imgUrl.startsWith("/uploads/ads/")) return;
  const filePath = path.join(
    process.cwd(),
    "uploads",
    "ads",
    path.basename(imgUrl),
  );
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

// GET /api/ads  ?status=active
function listAds(req, res) {
  const { status } = req.query;
  const conds = ["1=1"];
  const params = [];
  if (status) {
    conds.push("status = ?");
    params.push(status);
  }

  const rows = db
    .prepare(
      `SELECT * FROM ads WHERE ${conds.join(" AND ")} ORDER BY createdAt DESC`,
    )
    .all(...params);

  return res.json({ success: true, data: rows, meta: { total: rows.length } });
}

// POST /api/ads  — multipart: field "img" (file) + body: link, status
function createAd(req, res) {
  const { link = "", status = "published" } = req.body;

  const imgUrl = req.file
    ? `/uploads/ads/${req.file.filename}`
    : req.body.img || "";

  if (!imgUrl) {
    return res.status(400).json({
      success: false,
      message: "img is required (file upload or URL string)",
    });
  }

  const VALID_STATUS = ["published", "unpublished"];
  if (!VALID_STATUS.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${VALID_STATUS.join(", ")}`,
    });
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO ads (id, img, link, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
  ).run(id, imgUrl, link.trim(), status, now, now);

  return res.status(201).json({
    success: true,
    message: "Ad created",
    data: db.prepare("SELECT * FROM ads WHERE id = ?").get(id),
  });
}

// PUT /api/ads/:id  — multipart or JSON: link, status, img (optional new file/url)
function updateAd(req, res) {
  const { id } = req.params;
  const exists = db.prepare("SELECT * FROM ads WHERE id = ?").get(id);
  if (!exists)
    return res.status(404).json({ success: false, message: "Ad not found" });

  const sets = [],
    vals = [];

  // img: new file upload takes priority, then body string
  let newImg;
  if (req.file) {
    newImg = `/uploads/ads/${req.file.filename}`;
  } else if (req.body.img !== undefined) {
    newImg = req.body.img || null;
  }

  if (newImg !== undefined && newImg !== exists.img) {
    deleteLocalImg(exists.img);
    sets.push("img = ?");
    vals.push(newImg);
  }

  if (req.body.link !== undefined) {
    sets.push("link = ?");
    vals.push(req.body.link.trim());
  }

  if (req.body.status !== undefined) {
    const VALID_STATUS = ["published", "unpublished"];
    if (!VALID_STATUS.includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${VALID_STATUS.join(", ")}`,
      });
    }
    sets.push("status = ?");
    vals.push(req.body.status);
  }

  if (!sets.length) {
    return res.json({
      success: true,
      message: "Nothing to update",
      data: exists,
    });
  }

  sets.push("updatedAt = ?");
  vals.push(new Date().toISOString(), id);

  db.prepare(`UPDATE ads SET ${sets.join(", ")} WHERE id = ?`).run(...vals);

  return res.json({
    success: true,
    message: "Ad updated",
    data: db.prepare("SELECT * FROM ads WHERE id = ?").get(id),
  });
}

// DELETE /api/ads/:id
function deleteAd(req, res) {
  const { id } = req.params;
  const exists = db.prepare("SELECT * FROM ads WHERE id = ?").get(id);
  if (!exists)
    return res.status(404).json({ success: false, message: "Ad not found" });

  deleteLocalImg(exists.img);
  db.prepare("DELETE FROM ads WHERE id = ?").run(id);

  return res.json({ success: true, message: "Ad deleted" });
}

module.exports = { listAds, createAd, updateAd, deleteAd };
