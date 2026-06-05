// src/controllers/postsController.js
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const db = require("../data/db");

function parseTags(raw) {
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}

function fmt(row) {
  if (!row) return null;
  return { ...row, tags: parseTags(row.tags) };
}

function toSlug(title) {
  return (title || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Delete old local image file if it was stored locally
function deleteLocalImg(imgUrl) {
  if (!imgUrl || !imgUrl.startsWith("/uploads/posts/")) return;
  const filePath = path.join(
    process.cwd(),
    "uploads",
    "posts",
    path.basename(imgUrl),
  );
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

// POST /api/:section/posts/upload-image
// Standalone upload — returns { url } only, does NOT create a post
function uploadImage(req, res) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded. Field name must be "img"',
    });
  }
  const url = `/uploads/posts/${req.file.filename}`;
  return res.status(201).json({ success: true, url });
}

// GET /api/posts/search?q=keyword
function searchOnePost(req, res) {
  const keyword = (req.query.q || "").trim();
  if (!keyword)
    return res.status(400).json({ success: false, message: "q is required" });
  const row = db
    .prepare(
      "SELECT * FROM posts WHERE title LIKE ? COLLATE NOCASE ORDER BY createdAt DESC LIMIT 1",
    )
    .get(`%${keyword}%`);
  if (!row)
    return res.status(404).json({ success: false, message: "Post not found" });
  return res.json({ success: true, data: fmt(row) });
}

function trackPostView(req, res) {
  try {
    const { section, id } = req.params;
    const today = new Date().toISOString().slice(0, 10);

    const post = db.prepare(`SELECT id FROM posts WHERE id = ?`).get(id);
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    db.prepare(
      `
      INSERT INTO post_views (post_id, section, date, views)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(post_id, date) DO UPDATE SET views = views + 1
    `,
    ).run(id, section, today);

    return res.json({ success: true });
  } catch (err) {
    console.error("track post view error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/:section/posts
function listPosts(req, res) {
  const { section } = req.params;
  const {
    status,
    search,
    sort = "newest",
    page = "1",
    limit = "10",
  } = req.query;

  const pageNum = Math.max(parseInt(page) || 1, 1);
  const limitNum = Math.max(parseInt(limit) || 10, 1);
  const offset = (pageNum - 1) * limitNum;

  const conds = ["p.section = ?"]; // ← เพิ่ม alias p.
  const params = [section];

  if (status) {
    conds.push("p.status = ?"); // ← เพิ่ม alias p.
    params.push(status);
  }

  if (search) {
    conds.push("p.title LIKE ?"); // ← เพิ่ม alias p.
    params.push(`%${search}%`);
  }

  const where = conds.join(" AND ");

  const sortMap = {
    newest: "p.sortOrder ASC, p.createdAt DESC",
    oldest: "p.sortOrder ASC, p.createdAt ASC",
    title: "p.sortOrder ASC, p.title ASC",
  };

  const order = sortMap[sort] || sortMap.newest;

  // total (ไม่ต้อง JOIN เพราะนับแค่ posts)
  const total = db
    .prepare(`SELECT COUNT(*) as c FROM posts p WHERE ${where}`)
    .get(...params).c;

  // data + total_views ← JOIN post_views
  const rows = db
    .prepare(
      `SELECT p.*, COALESCE(SUM(v.views), 0) AS totalViews
       FROM posts p
       LEFT JOIN post_views v ON v.post_id = p.id
       WHERE ${where}
       GROUP BY p.id
       ORDER BY ${order}
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limitNum, offset);

  return res.json({
    success: true,
    data: rows.map(fmt),
    meta: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      hasNext: pageNum * limitNum < total,
      hasPrev: pageNum > 1,
    },
  });
}

function toSlug(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\u0E00-\u0E7Fa-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// GET /api/:section/posts/slug/:slug
function getPostBySlug(req, res) {
  const slug = decodeURIComponent(req.params.slug);

  const rows = db.prepare("SELECT * FROM posts").all();
  const row = rows.find((p) => toSlug(p.title) === slug);

  if (!row) {
    return res.status(404).json({ success: false, message: "Post not found" });
  }

  return res.json({ success: true, data: fmt(row) });
}

// GET /api/:section/posts/:id
function getPost(req, res) {
  const { section, id } = req.params;
  const row = db
    .prepare("SELECT * FROM posts WHERE section = ? AND id = ?")
    .get(section, id);
  if (!row)
    return res.status(404).json({ success: false, message: "Post not found" });
  return res.json({ success: true, data: fmt(row) });
}

// POST /api/:section/posts — JSON body, img = URL string
function createPost(req, res) {
  const { section } = req.params;
  const {
    title,
    content,
    description,
    category,
    tags,
    status,
    date,
    metaTitle,
    metaDesc,
    img,
    bannerImg,
  } = req.body;

  if (!title)
    return res
      .status(400)
      .json({ success: false, message: "title is required" });

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO posts (id, section, title, description, content, img, bannerImg, category, tags, status, date, metaTitle, metaDesc, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    section,
    title,
    description || "",
    content || "",
    img || null,
    bannerImg || null,
    category || "",
    JSON.stringify(parseTags(tags)),
    status || "draft",
    date || now.slice(0, 10),
    metaTitle || "",
    metaDesc || "",
    now,
    now,
  );

  return res.status(201).json({
    success: true,
    message: "Post created",
    data: fmt(db.prepare("SELECT * FROM posts WHERE id = ?").get(id)),
  });
}

// PUT /api/:section/posts/:id — JSON body, img = URL string
function updatePost(req, res) {
  const { section, id } = req.params;
  const exists = db
    .prepare("SELECT * FROM posts WHERE section = ? AND id = ?")
    .get(section, id);
  if (!exists)
    return res.status(404).json({ success: false, message: "Post not found" });

  const allowed = [
    "title",
    "content",
    "description",
    "category",
    "tags",
    "status",
    "date",
    "metaTitle",
    "metaDesc",
  ];
  const sets = [],
    vals = [];

  allowed.forEach((k) => {
    if (req.body[k] !== undefined) {
      sets.push(`${k} = ?`);
      vals.push(
        k === "tags" ? JSON.stringify(parseTags(req.body[k])) : req.body[k],
      );
    }
  });

  // img: only update if explicitly sent; delete old local file if replaced
  if (req.body.img !== undefined) {
    const newImg = req.body.img || null;
    if (newImg !== exists.img) deleteLocalImg(exists.img);
    sets.push("img = ?");
    vals.push(newImg);
  }

  if (req.body.bannerImg !== undefined) {
    const newImg = req.body.bannerImg || null;
    if (newImg !== exists.bannerImg) deleteLocalImg(exists.bannerImg);
    sets.push("bannerImg = ?");
    vals.push(newImg);
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
  db.prepare(`UPDATE posts SET ${sets.join(", ")} WHERE id = ?`).run(...vals);

  return res.json({
    success: true,
    message: "Post updated",
    data: fmt(db.prepare("SELECT * FROM posts WHERE id = ?").get(id)),
  });
}

// DELETE /api/:section/posts/:id
function deletePost(req, res) {
  const { section, id } = req.params;
  const exists = db
    .prepare("SELECT * FROM posts WHERE section = ? AND id = ?")
    .get(section, id);
  if (!exists)
    return res.status(404).json({ success: false, message: "Post not found" });
  deleteLocalImg(exists.img);
  db.prepare("DELETE FROM posts WHERE id = ?").run(id);
  return res.json({ success: true, message: "Post deleted" });
}

// DELETE /api/:section/posts/bulk
function bulkDelete(req, res) {
  const { section } = req.params;
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length)
    return res
      .status(400)
      .json({ success: false, message: "ids array is required" });

  const ph = ids.map(() => "?").join(", ");
  const rows = db
    .prepare(`SELECT img FROM posts WHERE section = ? AND id IN (${ph})`)
    .all(section, ...ids);
  rows.forEach((r) => deleteLocalImg(r.img));
  const result = db
    .prepare(`DELETE FROM posts WHERE section = ? AND id IN (${ph})`)
    .run(section, ...ids);
  return res.json({
    success: true,
    message: `${result.changes} post(s) deleted`,
  });
}

// PATCH /api/:section/posts/bulk-status
function bulkStatus(req, res) {
  const { section } = req.params;
  const { ids, status } = req.body;
  const valid = ["published", "unpublished", "draft", "hidden"];
  if (!Array.isArray(ids) || !ids.length || !valid.includes(status))
    return res
      .status(400)
      .json({ success: false, message: "ids and valid status are required" });

  const ph = ids.map(() => "?").join(", ");
  db.prepare(
    `UPDATE posts SET status = ?, updatedAt = ? WHERE section = ? AND id IN (${ph})`,
  ).run(status, new Date().toISOString(), section, ...ids);
  return res.json({
    success: true,
    message: `${ids.length} post(s) updated to ${status}`,
  });
}

function reorderPosts(req, res) {
  const { section } = req.params;
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "ids array is required" });
  }

  const stmt = db.prepare(
    "UPDATE posts SET sortOrder = ?, updatedAt = ? WHERE id = ? AND section = ?",
  );
  const now = new Date().toISOString();

  db.transaction(() => {
    ids.forEach((id, index) => {
      stmt.run(index, now, id, section);
    });
  })();

  return res.json({ success: true, message: "Reordered" });
}

function movePost(req, res) {
  const { section, id } = req.params;
  const { direction } = req.body;

  if (!["up", "down"].includes(direction)) {
    return res
      .status(400)
      .json({ success: false, message: "direction must be 'up' or 'down'" });
  }

  const posts = db
    .prepare(
      "SELECT id, sortOrder FROM posts WHERE section = ? ORDER BY sortOrder ASC, createdAt DESC",
    )
    .all(section);

  const currentIdx = posts.findIndex((p) => p.id === id);
  if (currentIdx === -1) {
    return res.status(404).json({ success: false, message: "Post not found" });
  }

  const swapIdx = direction === "up" ? currentIdx - 1 : currentIdx + 1;
  if (swapIdx < 0 || swapIdx >= posts.length) {
    return res.json({ success: true, message: "Already at boundary" });
  }

  // ✅ swap positions in array ก่อน
  [posts[currentIdx], posts[swapIdx]] = [posts[swapIdx], posts[currentIdx]];

  const now = new Date().toISOString();
  const stmt = db.prepare(
    "UPDATE posts SET sortOrder = ?, updatedAt = ? WHERE id = ?",
  );

  // ✅ เขียน sortOrder ใหม่จาก index — ป้องกัน duplicate/null
  db.transaction(() => {
    posts.forEach((p, index) => {
      stmt.run(index, now, p.id);
    });
  })();

  return res.json({ success: true, message: "Moved" });
}

// GET /api/posts/suggest?q=keyword
function suggestPosts(req, res) {
  const keyword = (req.query.q || "").trim();
  if (!keyword || keyword.length < 1)
    return res.json({ success: true, data: [] });

  const rows = db
    .prepare(
      `SELECT id, title, category, section FROM posts
       WHERE title LIKE ? COLLATE NOCASE AND status = 'published'
       ORDER BY createdAt DESC LIMIT 6`,
    )
    .all(`%${keyword}%`);

  return res.json({ success: true, data: rows });
}

module.exports = {
  listPosts,
  searchOnePost,
  getPost,
  getPostBySlug,
  createPost,
  updatePost,
  deletePost,
  bulkDelete,
  bulkStatus,
  uploadImage,
  reorderPosts,
  movePost,
  trackPostView,
  suggestPosts,
};
