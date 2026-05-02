// src/routes/combined.js
const express = require('express')
const router  = express.Router()
const { getCombinedPosts } = require('../controllers/combinedController')

router.get('/', getCombinedPosts)

module.exports = router
