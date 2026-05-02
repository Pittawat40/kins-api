// src/controllers/combinedController.js
const db = require('../data/db')

const SECTIONS = ['hotels', 'realestate', 'travel', 'lifestyle']

// GET /api/posts/combined
function getCombinedPosts(req, res) {
  const { limit = 20, status, search } = req.query

  const ph     = SECTIONS.map(() => '?').join(', ')
  const conds  = [`section IN (${ph})`]
  const params = [...SECTIONS]

  if (status) { conds.push('status = ?'); params.push(status) }
  if (search) { conds.push('title LIKE ?'); params.push(`%${search}%`) }

  const limitNum = Math.min(parseInt(limit) || 20, 100)
  const rows = db.prepare(
    `SELECT * FROM posts WHERE ${conds.join(' AND ')} ORDER BY createdAt DESC LIMIT ?`
  ).all(...params, limitNum)

  const data = rows.map(r => ({
    ...r,
    tags: (() => { try { return JSON.parse(r.tags || '[]') } catch { return [] } })(),
  }))

  return res.json({ success: true, data, meta: { total: data.length } })
}

module.exports = { getCombinedPosts }
