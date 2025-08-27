const express = require('express')
const order = require('../controller/orderControllers')

const { routerGuard } = require('../controller/authController')

const router = express.Router()

// 建立訂單（從購物車生成 → 同時檢查庫存、扣減庫存）(前台)
router.post('/create', order.createOrder)

// 查詢該訂單 (前台)
router.get('/my_order/:orderNo', order.findMyOrder)

// 查詢該訂單 (後台)
router.get('/order_admin/:orderNo', order.findOneOrderAdmin)

// 查詢該用戶所有訂單 (前台)
router.post('/my_orders', order.findMyOrders)

// 查詢所有訂單 (後台)
router.post('/orders_admin', order.findAllOrdersAdmin)

// 修改訂單狀態 (前台)
router.patch('/order/:id/status/:status', order.updateOrderStatus)

// 修改訂單狀態 (後台)
router.patch('/order_admin/:id/status/:status', order.updateOrderStatusAdmin)

module.exports = router
