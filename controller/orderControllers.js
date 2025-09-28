const { ObjectId } = require('mongodb')

const { collection, collectionExists, DB } = require('../utils/db')
const { catchError } = require('../utils/catchError')
const AppError = require('../utils/appError')

const { orderJsonSchema } = require('../schema/order/mongoSchema')
const {
  createOrderSchema,
  orderNoSchema,
  orderStatusSchema,
  orderStatusAdminSchema
} = require('../schema/order/zodSchema')
const { schemaValidator } = require('../utils/schemaValidator')

const { validateObjectId } = require('../utils/utils.js')
const SearchDoc = require('../utils/search')

// 建立訂單（從購物車生成 → 同時檢查庫存、扣減庫存）(前台)
/**
 * @param {string} req.user._id
 *
 * @param {array<object>} req.body.productsOrdered
 * [{productId, quantity}]
 * @param {string} productId
 * @param {number} quantity
 *
 * @param {string} req.body.receiver
 * @param {string} req.body.receiverAddress
 * @param {string} req.body.receiverPhoneNumber
 * @param {string} req.body.note
 */
exports.createOrder = catchError(async (req, res, next) => {
  const userId = validateObjectId(req.user._id, res)
  const user = req.user

  const OrdersExist = await collectionExists('orders')

  if (!OrdersExist) {
    const db = DB()

    await db.createCollection('orders', {
      validator: orderJsonSchema
    })

    await db.collection('orders').createIndex({ orderNo: 1 }, { unique: true })
    await db.collection('orders').createIndex({ userId: 1, createdAt: -1 })
    await db.collection('orders').createIndex({ email: 1, createdAt: -1 })
    await db.collection('orders').createIndex({ account: 1, createdAt: -1 })
    await db.collection('orders').createIndex({ orderStatus: 1, createdAt: -1 })
    await db.collection('orders').createIndex({ receiver: 1, createdAt: -1 })
    await db
      .collection('orders')
      .createIndex({ 'productsOrdered.productId': 1, createdAt: -1 })
  }

  const parsedData = schemaValidator(res, createOrderSchema, req.body)
  if (!parsedData) return

  // 1) 讀商品快照
  const Products = collection('products')
  const { productsOrdered } = parsedData
  const productsIds = productsOrdered.map((i) =>
    validateObjectId(i.productId, res)
  )

  // 訂購商品中, 仍在架販售中的商品
  const productDocs = await Products.find(
    { _id: { $in: productsIds }, enable: true, inStock: { $gt: 0 } },
    {
      projection: {
        productNameMain: 1,
        productNameSub: 1,
        price: 1,
        category: 1,
        mainPhoto: 1,
        inStock: 1
      }
    }
  ).toArray()

  console.log('productDocs', productDocs)

  // 建立 productId -> doc 快取
  const productMap = new Map(productDocs.map((p) => [p._id.toString(), p]))

  // 2) 組成訂單明細 + 基本檢查
  const orderItems = productsOrdered.map((item) => {
    const p = productMap.get(item.productId)
    if (!p) {
      // return res.status(400).json({
      //   status: 'failed',
      //   msg: '商品不存在或已下架'
      // })
      throw new AppError('有商品不存在或已下架', 400)
    }

    if (p.inStock < item.quantity) {
      // return res.status(400).json({
      //   status: 'failed',
      //   inStock: p.inStock,
      //   orderQuantity: item.quantity,
      //   productId: p._id,
      //   msg: `${p.productNameMain} ${p.productNameSub} 庫存不足, 庫存 ${p.inStock}`
      // })
      throw new AppError(
        `${p.productNameMain} ${p.productNameSub} 庫存不足, 庫存 ${p.inStock}`,
        400
      )
    }

    console.log('item', item)

    const price = Number(p.price)
    return {
      productId: new ObjectId(item.productId),
      productNameMain: p.productNameMain,
      productNameSub: p.productNameSub,
      price,
      mainPhoto: {
        url: p.mainPhoto.url
      },
      category: p.category,
      quantity: item.quantity,
      subtotal: price * item.quantity
    }
  })

  // 3) 計算總金額（> 0）
  const totalAmount = orderItems.reduce((s, it) => s + it.subtotal, 0)
  if (!(totalAmount > 0)) {
    // return res.status(400).json({
    //   status: 'failed',
    //   msg: '總金額必須 > 0'
    // })
    throw new AppError('總金額必須 > 0', 400)
  }

  // 4) 準備訂單文件
  const Orders = collection('orders')
  const now = new Date()
  const { receiver, receiverAddress, receiverPhoneNumber, note } = parsedData

  const orderDoc = {
    orderNo: getOrderNo(),
    account: user.account,
    email: user.email,
    userId,
    productsOrdered: orderItems,
    totalAmount,
    orderStatus: 'pending',
    receiver,
    receiverAddress,
    receiverPhoneNumber,
    note: note ? note : null,
    createdAt: now,
    updatedAt: now
  }

  // 5) 交易：條件扣庫存（檢查 + 扣減在同一步）＋ 寫入訂單
  const client = (await collection('_dummy')).client // 取 MongoClient
  const session = client.startSession()
  let insertedId

  try {
    await session.withTransaction(async () => {
      // (A) 扣庫存：只允許 inStock >= qty 的商品被扣到
      const ops = orderItems.map((it) => ({
        updateOne: {
          filter: {
            _id: it.productId,
            enable: true,
            inStock: { $gte: it.quantity }
          },
          update: { $inc: { inStock: -it.quantity } }
        }
      }))

      const r = await Products.bulkWrite(ops, { session, ordered: false })
      // 所有商品都必須成功扣到，否則視為庫存不足（觸發回滾）
      if (r.modifiedCount !== orderItems.length) {
        throw new AppError('庫存不足或商品狀態變動，請重新整理購物車', 409)
        // return res.status(409).json({
        //   status: 'failed',
        //   msg: '庫存不足或商品狀態變動，請重新整理購物車'
        // })
      }

      // (B) 寫入訂單（處理 orderNo 撞號重試一次）
      try {
        const ins = await Orders.insertOne(orderDoc, { session })
        insertedId = ins.insertedId
      } catch (e) {
        if (e.code === 11000) {
          // orderNo unique 衝突
          orderDoc.orderNo = getOrderNo()
          const ins = await Orders.insertOne(orderDoc, { session })
          insertedId = ins.insertedId
        } else {
          throw e
        }
      }
    })
  } finally {
    await session.endSession()
  }

  const Carts = collection('carts')
  await Carts.deleteMany({ userId })

  // 6) 成功
  return res.status(201).json({
    status: 'success',
    msg: '建立訂單成功',
    orderId: insertedId,
    orderNo: orderDoc.orderNo
  })
})

function getOrderNo() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const y = d.getUTCFullYear()
  const M = pad(d.getUTCMonth() + 1)
  const D = pad(d.getUTCDate())
  const h = pad(d.getUTCHours())
  const m = pad(d.getUTCMinutes())
  const s = pad(d.getUTCSeconds())
  const rnd = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')
  return `${y}${M}${D}${h}${m}${s}${rnd}` // 例如 202508231410559876
}

/*============= 訂單查詢 =============*/
// 查詢該訂單 (前台)
/*
  GET /my_order/:orderNo
*/
exports.findMyOrder = catchError(async (req, res, next) => {
  await findOne(req, res)
})

// 查詢該訂單 (後台)
/*
  GET /order_admin/:orderNo
*/
exports.findOneOrderAdmin = catchError(async (req, res, next) => {
  await findOne(req, res, 'admin')
})

/**
 * @param {string} req.params.orderNo
 */
async function findOne(req, res, reqFrom = 'front') {
  const parsedData = schemaValidator(res, orderNoSchema, req.params)
  if (!parsedData) return

  const orderNo = parsedData.orderNo

  const Orders = collection('orders')
  const data = await Orders.findOne({ orderNo })

  if (!data) {
    return res.status(404).json({ status: 'failed', msg: '訂單不存在' })
  }

  const sumQuantity = data.productsOrdered.reduce(
    (acc, p) => acc + p.quantity,
    0
  )
  data.sumQuantity = sumQuantity

  return res.status(200).json({ status: 'success', msg: '查詢成功', data })
}

// 查詢該用戶所有訂單 (前台)
/*
  POST /my_orders
*/
exports.findMyOrders = catchError(async (req, res, next) => {
  // const userId = validateObjectId(req.body.userId, res)
  const userId = validateObjectId(req.user._id, res)

  // const queryCondition = { ...req.body }
  // queryCondition.userId = userId

  // const orders = new SearchDoc('orders', queryCondition)
  // const dataCount = await orders.countDocuments()
  // const data = await orders.filter().sort().limitFields().pagination().exec()
  const Orders = collection('orders')
  const data = await Orders.find({ userId }).sort({ updatedAt: 1 }).toArray()
  console.log('data', data)

  return res.status(200).json({
    status: 'success',
    data
  })
})

// 查詢所有訂單 (後台)
/*
  POST /orders_admin
*/
exports.findAllOrdersAdmin = catchError(async (req, res, next) => {
  const queryCondition = { ...req.body }

  const orders = new SearchDoc('orders', queryCondition)
  const dataCount = await orders.countDocuments()
  const data = await orders.filter().sort().limitFields().pagination().exec()
  const totalPages = orders.limit > 0 ? Math.ceil(dataCount / orders.limit) : 1

  return res.status(200).json({
    status: 'success',
    data,
    dataCount,
    totalPages,
    page: orders.currentPage,
    limit: orders.limit
  })
})

/*============= 訂單狀態 =============*/
const ORDER_TRANSITIONS = {
  pending: ['shipping', 'cancelled'], // 訂單確認中 → 可出貨或取消
  shipping: ['completed', 'cancelled'], // 運送中 → 收貨完成 or 退貨取消
  completed: [], // 完成後不可再改
  cancelled: [] // 取消後不可再改
}

function canTransit(from, to) {
  return ORDER_TRANSITIONS[from]?.includes(to)
}

// 修改訂單狀態 (前台)
/*
  PATCH /order/:id/status/:status
  body: { newStatus: 'cancelled' }
*/
exports.updateOrderStatus = catchError(async (req, res, next) => {
  await setOrderStatus(req, res)
})

// 修改訂單狀態 (後台)
/**
 * PATCH /order_admin/:id/status/:status
 * @param {string} req.params.id
 *
 * 下個訂單狀態
 * @param {string<newStatus: 'shipping' | 'completed' | 'cancelled'>} req.params.status
 */
exports.updateOrderStatusAdmin = catchError(async (req, res, next) => {
  await setOrderStatus(req, res, 'admin')
})

async function setOrderStatus(req, res, reqFrom = 'front') {
  const id = validateObjectId(req.params.id)

  const statusSchema =
    reqFrom === 'front' ? orderStatusSchema : orderStatusAdminSchema
  const parsedData = schemaValidator(res, statusSchema, req.params)

  if (!parsedData) return
  const newStatus = parsedData.status

  const Orders = collection('orders')

  // 1) 取目前狀態與品項
  const order = await Orders.findOne(
    { _id: id },
    { projection: { orderStatus: 1, productsOrdered: 1 } }
  )
  if (!order) {
    return res.status(404).json({
      status: 'failed',
      msg: '訂單不存在'
    })
  }

  const from = order.orderStatus
  if (!canTransit(from, newStatus)) {
    return res.status(400).json({
      status: 'failed',
      msg: `狀態不可由 ${from} → ${newStatus}`
    })
  }

  // 2) 非取消：單純更新狀態
  if (newStatus !== 'cancelled') {
    const result = await Orders.updateOne(
      { _id: id, orderStatus: from }, // 防併發
      { $set: { orderStatus: newStatus, updatedAt: new Date() } }
    )

    if (result.matchedCount === 0) {
      return res.status(409).json({
        status: 'failed',
        msg: '訂單不存在或狀態已改變，請重新整理'
      })
    }

    if (result.modifiedCount === 0) {
      return res.status(400).json({
        status: 'failed',
        msg: '狀態沒有變化'
      })
    }

    return res.status(200).json({
      status: 'success',
      msg: `訂單狀態已由 ${from} → ${newStatus}`
    })
  }

  // 3) 取消：還原庫存 + 更新狀態（交易）
  const Products = collection('products')
  const client = (await collection('_dummy')).client
  const session = client.startSession()

  try {
    await session.withTransaction(async () => {
      // (A) 歸還庫存（逐品項加回）
      if (
        Array.isArray(order.productsOrdered) &&
        order.productsOrdered.length > 0
      ) {
        const ops = order.productsOrdered.map((it) => ({
          updateOne: {
            filter: { _id: it.productId }, // 商品可能已下架，但仍要還庫存
            update: { $inc: { inStock: Number(it.quantity) || 0 } }
          }
        }))
        if (ops.length > 0) {
          await Products.bulkWrite(ops, { session, ordered: false })
        }
      }

      // (B) 更新訂單狀態（帶舊狀態條件，避免重複歸還）
      const r = await Orders.updateOne(
        { _id: id, orderStatus: from },
        { $set: { orderStatus: 'cancelled', updatedAt: new Date() } },
        { session }
      )

      if (r.modifiedCount === 0) {
        // 若狀態被別人先改了，丟錯觸發回滾（庫存不會被多加）
        return res.status(409).json({
          status: 'failed',
          msg: '狀態已變更，請重新整理頁面'
        })
      }
    })
  } finally {
    await session.endSession()
  }

  return res.status(200).json({
    status: 'success',
    msg: `訂單狀態已由 ${from} → cancelled，庫存已歸還`
  })
}
