// src/controllers/dashboardController.js
const { v4: uuidv4 } = require("uuid");
const db = require("../data/db");

// ── Migration: สร้าง table dashboard_items ถ้ายังไม่มี ────────
db.exec(`
  CREATE TABLE IF NOT EXISTS dashboard_items (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    content     TEXT NOT NULL DEFAULT '',
    img         TEXT,
    link        TEXT NOT NULL DEFAULT '',
    sortOrder   INTEGER NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'published',
    createdAt   TEXT NOT NULL,
    updatedAt   TEXT NOT NULL
  );
`);

function fmt(row) {
  if (!row) return null;
  return row;
}

// ถ้า upload ไฟล์มา ใช้ path; ถ้าส่ง URL string ใน body ก็ใช้ตรงๆ
function resolveImg(req) {
  if (req.file) return `/uploads/posts/${req.file.filename}`;
  return req.body.img !== undefined ? req.body.img : undefined;
}

function getOverview(req, res) {
  try {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const monthPrefix = today.slice(0, 7);
    const yearPrefix = today.slice(0, 4); // ← เพิ่ม

    const todayRow = db
      .prepare(
        `
      SELECT COALESCE(views, 0) AS views
      FROM page_views WHERE date = ?
    `,
      )
      .get(today);

    const monthRow = db
      .prepare(
        `
      SELECT COALESCE(SUM(views), 0) AS views
      FROM page_views WHERE date LIKE ?
    `,
      )
      .get(`${monthPrefix}%`);

    const totalRow = db
      .prepare(
        `
      SELECT COALESCE(SUM(views), 0) AS views
      FROM page_views
    `,
      )
      .get();

    // ← เพิ่ม: รายเดือนของปีนี้
    const monthlyRows = db
      .prepare(
        `
      SELECT
        strftime('%m', date) AS month,
        SUM(views)           AS views
      FROM page_views
      WHERE date LIKE ?
      GROUP BY strftime('%m', date)
      ORDER BY month ASC
    `,
      )
      .all(`${yearPrefix}%`);

    return res.json({
      success: true,
      data: {
        today: todayRow?.views ?? 0,
        month: monthRow?.views ?? 0,
        total: totalRow?.views ?? 0,
        monthly: monthlyRows, // ← เพิ่ม
      },
    });
  } catch (err) {
    console.error("dashboard overview error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/dashboard/items
function listItems(req, res) {
  const { status, sort = "order" } = req.query;

  const conds = ["1=1"];
  const params = [];

  if (status) {
    conds.push("status = ?");
    params.push(status);
  }

  const orderMap = {
    order: "sortOrder ASC, createdAt DESC",
    newest: "createdAt DESC",
    oldest: "createdAt ASC",
  };
  const order = orderMap[sort] ?? "sortOrder ASC, createdAt DESC";

  const rows = db
    .prepare(
      `SELECT * FROM dashboard_items WHERE ${conds.join(" AND ")} ORDER BY ${order}`,
    )
    .all(...params);

  return res.json({
    success: true,
    data: rows.map(fmt),
    meta: { total: rows.length },
  });
}

// GET /api/dashboard/items/:id
function getItem(req, res) {
  const row = db
    .prepare("SELECT * FROM dashboard_items WHERE id = ?")
    .get(req.params.id);
  if (!row)
    return res.status(404).json({ success: false, message: "Item not found" });
  return res.json({ success: true, data: fmt(row) });
}

// POST /api/dashboard/items
function createItem(req, res) {
  const {
    title = "",
    description = "",
    content = "",
    link = "",
    sortOrder = 0,
    status = "published",
  } = req.body;
  const img = resolveImg(req);

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO dashboard_items (id, title, description, content, img, link, sortOrder, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    title,
    description,
    content,
    img || null,
    link,
    Number(sortOrder),
    status,
    now,
    now,
  );

  return res.status(201).json({
    success: true,
    message: "Item created",
    data: fmt(db.prepare("SELECT * FROM dashboard_items WHERE id = ?").get(id)),
  });
}

// PUT /api/dashboard/items/:id
function updateItem(req, res) {
  const { id } = req.params;
  const exists = db
    .prepare("SELECT * FROM dashboard_items WHERE id = ?")
    .get(id);
  if (!exists)
    return res.status(404).json({ success: false, message: "Item not found" });

  const allowed = [
    "title",
    "description",
    "content",
    "link",
    "sortOrder",
    "status",
  ];
  const sets = [],
    vals = [];

  allowed.forEach((k) => {
    if (req.body[k] !== undefined) {
      sets.push(`${k} = ?`);
      vals.push(k === "sortOrder" ? Number(req.body[k]) : req.body[k]);
    }
  });

  // img: file upload takes priority over body string
  const newImg = resolveImg(req);
  if (newImg !== undefined) {
    sets.push("img = ?");
    vals.push(newImg || null);
  }

  if (!sets.length) {
    return res.json({
      success: true,
      message: "Nothing to update",
      data: fmt(exists),
    });
  }

  sets.push("updatedAt = ?");
  vals.push(new Date().toISOString(), id);

  db.prepare(`UPDATE dashboard_items SET ${sets.join(", ")} WHERE id = ?`).run(
    ...vals,
  );

  return res.json({
    success: true,
    message: "Item updated",
    data: fmt(db.prepare("SELECT * FROM dashboard_items WHERE id = ?").get(id)),
  });
}

// DELETE /api/dashboard/items/:id
function deleteItem(req, res) {
  const { id } = req.params;
  const exists = db
    .prepare("SELECT * FROM dashboard_items WHERE id = ?")
    .get(id);
  if (!exists)
    return res.status(404).json({ success: false, message: "Item not found" });
  db.prepare("DELETE FROM dashboard_items WHERE id = ?").run(id);
  return res.json({ success: true, message: "Item deleted" });
}

// PATCH /api/dashboard/items/reorder  — body: { ids: ["id1","id2",...] }
function reorderItems(req, res) {
  const { ids } = req.body;
  const section = "dashboard";

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: "ids array is required",
    });
  }

  const now = new Date().toISOString();

  try {
    const stmt = db.prepare(`
      UPDATE banners
      SET sortOrder = ?
      WHERE id = ? AND section = ?
    `);

    const trx = db.transaction((ids) => {
      ids.forEach((id, index) => {
        stmt.run(index + 1, id, section);
      });
    });

    trx(ids);

    return res.json({
      success: true,
      message: "Banners reordered",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Reorder failed",
    });
  }
}

function trackPageView(req, res) {
  try {
    // ดึงวันที่ปัจจุบันตาม Timezone ของไทย
    const today = new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()); // ผลลัพธ์ที่ได้จะเป็น 'YYYY-MM-DD' ทันที

    db.prepare(
      `
      INSERT INTO page_views (date, views)
      VALUES (?, 1)
      ON CONFLICT(date) DO UPDATE SET views = views + 1
    `,
    ).run(today);

    return res.json({
      success: true,
      message: "Track success",
    });
  } catch (err) {
    console.error("Database track pageview error:", err);
    return res.status(500).json({
      success: false,
      message: "Track failed",
    });
  }
}

module.exports = {
  getOverview,
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  reorderItems,
  trackPageView,
};
