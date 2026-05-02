// src/data/db.js
const Database = require("better-sqlite3");
const path = require("path");
const bcrypt = require("bcryptjs");

const db = new Database(path.join(__dirname, "../../valeur.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Schema ────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    email    TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role     TEXT NOT NULL DEFAULT 'editor'
  );

  CREATE TABLE IF NOT EXISTS revoked_tokens (
    token      TEXT PRIMARY KEY,
    revoked_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS posts (
    id          TEXT PRIMARY KEY,
    section     TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT    DEFAULT '',
    content     TEXT    DEFAULT '',
    img         TEXT,
    category    TEXT    DEFAULT '',
    tags        TEXT    DEFAULT '[]',
    status      TEXT    DEFAULT 'draft',
    date        TEXT,
    metaTitle   TEXT    DEFAULT '',
    metaDesc    TEXT    DEFAULT '',
    createdAt   TEXT NOT NULL,
    updatedAt   TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_posts_section ON posts(section);
  CREATE INDEX IF NOT EXISTS idx_posts_status  ON posts(status);
  CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(createdAt);

  CREATE TABLE IF NOT EXISTS banners (
    id           TEXT PRIMARY KEY,
    section      TEXT NOT NULL,
    filename     TEXT NOT NULL,
    originalName TEXT NOT NULL,
    url          TEXT NOT NULL,
    size         INTEGER DEFAULT 0,
    active       INTEGER DEFAULT 0,
    sortOrder    INTEGER DEFAULT 0,
    createdAt    TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_banners_section ON banners(section);
`);

// ── Migration: add description column if not exists ──────────
try {
  db.exec("ALTER TABLE posts ADD COLUMN description TEXT DEFAULT ''");
} catch (e) {}

// ── Migration: add sortOrder to banners ───────────────────────
try {
  db.exec("ALTER TABLE banners ADD COLUMN sortOrder INTEGER DEFAULT 0");
} catch (e) {}

// ── Migration: set initial sortOrder (run once if needed) ─────
try {
  const hasOrdered = db
    .prepare("SELECT COUNT(*) as count FROM banners WHERE sortOrder != 0")
    .get().count;

  if (!hasOrdered) {
    const banners = db
      .prepare("SELECT id FROM banners ORDER BY createdAt ASC")
      .all();

    const stmt = db.prepare("UPDATE banners SET sortOrder = ? WHERE id = ?");

    const trx = db.transaction(() => {
      banners.forEach((b, i) => {
        stmt.run(i, b.id);
      });
    });

    trx();
    console.log("Initialized banner sortOrder");
  }
} catch (e) {
  console.log("sortOrder init skipped");
}

// ── Seed ──────────────────────────────────────────────────────
const admin = db.prepare("SELECT id FROM users WHERE email = ?").get("admin");

if (!admin) {
  db.prepare(
    "INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)",
  ).run("1", "Admin", "admin", bcrypt.hashSync("admin1234", 10), "admin");
}

module.exports = db;
