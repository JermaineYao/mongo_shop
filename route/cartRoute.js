const express = require('express')
const cart = require('../controller/cartController')

const { routerGuard } = require('../controller/authController')

const router = express.Router()

// 新增,修改 購物車 (前台)
router.post('/update', cart.addOrUpdateCart)

// 查詢我的購物車 (前台)
router.get('/my_cart', routerGuard, cart.findCarts)

// 移除該購物車項目 (前台)
router.post('/delete', cart.deleteCart)

// 清空我的購物車 (前台)
router.get('/clear', routerGuard, cart.clearMyCarts)

module.exports = router
