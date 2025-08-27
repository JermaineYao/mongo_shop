const express = require('express')
const favoriate = require('../controller/favoriteController')

const { routerGuard } = require('../controller/authController')

const router = express.Router()

// 新增,移除 我的最愛 (前台)
router.post('/toggle', favoriate.toggleFavorite)

// 查詢我的最愛
router.post('/find', favoriate.findFavorites)

// 清空我的最愛
router.post('/clear', favoriate.clearMyFavorites)

module.exports = router
