// src/middleware/auth.js
const jwt = require('jsonwebtoken')
const db  = require('../data/db')

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization']
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' })
  }

  const token = authHeader.split(' ')[1]

  const revoked = db.prepare('SELECT token FROM revoked_tokens WHERE token = ?').get(token)
  if (revoked) {
    return res.status(401).json({ success: false, message: 'Token has been revoked (logged out)' })
  }

  try {
    req.user  = jwt.verify(token, process.env.JWT_SECRET)
    req.token = token
    next()
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' })
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' })
    }
    next()
  }
}

module.exports = { authenticate, requireRole }
