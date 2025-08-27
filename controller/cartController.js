const { collection, collectionExists, DB } = require('../utils/db')
const { catchError } = require('../utils/catchError')

const { cartJsonSchema } = require('../schema/cart/mongoSchema')
const { createCartSchema } = require('../schema/cart/zodSchema')
const { schemaValidator } = require('../utils/schemaValidator')

const { validateObjectId } = require('../utils/utils')

// 新增,修改 購物車 (前台)
exports.addOrUpdateCart = catchError(async (req, res, next) => {
  const cartsExist = await collectionExists('carts')

  if (!cartsExist) {
    const db = DB()

    await db.createCollection('carts', {
      validator: cartJsonSchema
    })

    await db
      .collection('carts')
      .createIndex({ userId: 1, productId: 1 }, { unique: true })
  }

  const parsedData = schemaValidator(res, createCartSchema, req.body)
  if (!parsedData) return

  const Products = collection('products')
  const Carts = collection('carts')
  const now = new Date()
  const { quantity } = parsedData
  const userId = validateObjectId(parsedData.userId)
  const productId = validateObjectId(parsedData.productId)

  const product = await Products.findOne({
    _id: productId
  })

  if (!product) {
    return res.status(404).json({ status: 'failed', msg: '商品已下架' })
  }

  const cart = await Carts.findOneAndUpdate(
    { userId, productId },
    { $set: { quantity, addedAt: now } },
    { upsert: true, returnDocument: 'after' }
  )

  if (!cart) {
    return res.status(500).json({ status: 'failed', msg: '購物車更新失敗' })
  }

  return res.status(200).json({
    status: 'success',
    msg: '購物車已更新',
    data: cart
  })
})

// 查詢我的購物車 (前台)
exports.findCarts = catchError(async (req, res, next) => {
  const userId = validateObjectId(req.body.userId, res)
  // const userId = validateObjectId(req.user._id, res)

  const Carts = collection('carts')

  const data = await Carts.aggregate([
    { $match: { userId } },
    { $sort: { addedAt: -1 } },
    {
      $lookup: {
        from: 'products',
        localField: 'productId',
        foreignField: '_id',
        as: 'product'
      }
    },
    {
      $unwind: {
        path: '$product',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      _id: 0,
      cartId: '$_id',
      productId: '$product._id',
      productNameMain: '$product.productNameMain',
      productNameSub: '$product.productNameSub',
      category: '$product.category',
      price: '$product.price',
      inStock: '$product.inStock',
      enable: '$product.enable',
      mainPhoto: '$product.mainPhoto',
      totalPrice: { $multiply: ['$product.price', '$quantity'] }
    },
    {
      $group: {
        _id: null,
        products: {
          $push: {
            cartId: '$cartId',
            productId: '$productId',
            productNameMain: '$productNameMain',
            productNameSub: '$productNameSub',
            category: '$category',
            price: '$price',
            quantity: '$quantity',
            inStock: '$inStock',
            enable: '$enable',
            mainPhoto: '$mainPhoto',
            totalPrice: '$totalPrice'
          }
        },
        totalQuantity: { $sum: '$quantity' },
        grandTotal: { $sum: '$totalPrice' }
      }
    },
    {
      $project: {
        _id: 0,
        products: 1,
        summary: {
          totalQuantity: '$totalQuantity',
          grandTotal: '$grandTotal'
        }
      }
    }
  ]).toArray()

  return res.status(200).json({
    status: 'success',
    msg: '查詢成功',
    data
  })
})

// 移除該購物車項目 (前台)
exports.deleteCart = catchError(async (req, res, next) => {
  const cartId = validateObjectId(req.body.cartId)

  const Carts = collection('carts')

  const deleteResult = await Carts.deleteOne({ _id: cartId })

  if (deleteResult.deletedCount === 0) {
    return res.status(404).json({
      status: 'failed',
      msg: '從購物車移除失敗'
    })
  }

  return res.status(200).json({
    status: 'success',
    msg: '已從購物車中移除'
  })
})

// 清空我的購物車 (前台)
exports.clearMyCarts = catchError(async (req, res, next) => {
  const userId = validateObjectId(req.body.userId, res)
  // const userId = validateObjectId(req.user._id, res)

  const Carts = collection('carts')
  await Carts.deleteMany({ userId })

  return res.status(200).json({
    status: 'success',
    msg: '已清空購物車'
  })
})
