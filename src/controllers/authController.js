// src/controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../data/db");

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const EXPIRES_IN = "10s"; // ← ตรงกัน
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: EXPIRES_IN,
    });

    const expiresAt = Date.now() + 10 * 1000;
    // const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    return res.json({
      success: true,
      message: "Login successful",
      data: { token, expiresAt, user: payload },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/auth/logout
function logout(req, res) {
  db.prepare(
    "INSERT OR IGNORE INTO revoked_tokens (token, revoked_at) VALUES (?, ?)",
  ).run(req.token, new Date().toISOString());
  return res.json({ success: true, message: "Logged out successfully" });
}

// GET /api/auth/me
function me(req, res) {
  return res.json({ success: true, data: req.user });
}

module.exports = { login, logout, me };
