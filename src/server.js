// src/server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const postsRoutes = require("./routes/posts");
const bannersRoutes = require("./routes/banners");
const combinedRoutes = require("./routes/combined");
const dashboardRoutes = require("./routes/dashboard");
const adsRoutes = require("./routes/ads");
const contactRoutes = require("./routes/contact");

const {
  searchOnePost,
  suggestPosts,
} = require("./controllers/postsController");

const app = express();
const PORT = process.env.PORT || 3002;

// ── Global middleware ──────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:4000",
  "https://kins-nuxt.vercel.app",
  process.env.FRONTEND_URL, // ← เพิ่ม
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(path.join(__dirname, "..", "uploads")),
);

// ── Health ─────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "Valeur API is running",
    time: new Date().toISOString(),
  });
});

// ──Search ──────────────────────────────────────────────
app.get("/api/posts/search", searchOnePost);
app.get("/api/posts/suggest", suggestPosts);

// ── Routes ─────────────────────────────────────────────────────
// combined must be registered BEFORE :section wildcard routes
app.use("/api/auth", authRoutes);
app.use("/api/posts/combined", combinedRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api", contactRoutes);
app.use("/api/ads", adsRoutes);
app.use("/api/:section/posts", postsRoutes);
app.use("/api/:section/banners", bannersRoutes);

// ── 404 ────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// ── Error handler ──────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res
    .status(err.status || 500)
    .json({ success: false, message: err.message || "Internal server error" });
});

// ── Start ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Valeur API  →  http://localhost:${PORT}`);
  console.log(`    Health       →  http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
