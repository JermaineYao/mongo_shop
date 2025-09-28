const { collection, collectionExists, DB } = require('../utils/db')
const { catchError } = require('../utils/catchError')

const { cartJsonSchema } = require('../schema/cart/mongoSchema')
const { createCartSchema } = require('../schema/cart/zodSchema')
const { schemaValidator } = require('../utils/schemaValidator')

const { validateObjectId } = require('../utils/utils')

// 新增,修改 購物車 (前台)
/**
 * @param {string} req.user._id
 * @param {string} req.body.productId
 * @param {number} req.body.quantity
 */
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

  const userId = validateObjectId(req.user._id, res)

  const Products = collection('products')
  const Carts = collection('carts')
  const now = new Date()
  const { quantity } = parsedData
  const productId = validateObjectId(parsedData.productId)

  const product = await Products.findOne({
    _id: productId,
    enable: true,
    inStock: { $gt: 0 }
  })

  if (!product) {
    return res.status(404).json({ status: 'failed', msg: '商品已下架或已售完' })
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
/**
 * @param {string} req.user._id
 */
exports.findCarts = catchError(async (req, res, next) => {
  const userId = validateObjectId(req.user._id, res)

  const Carts = collection('carts')

  const data = await Carts.aggregate([
    { $match: { userId } },
    // { $sort: { addedAt: -1 } },
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
      $match: { 'product.enable': true }
    },
    {
      $project: {
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
        quantity: '$quantity',
        totalPrice: { $multiply: ['$product.price', '$quantity'] }
      }
    },
    {
      $group: {
        _id: null,
        products: {
          $push: {
            cartId: '$cartId',
            product: {
              productId: '$productId',
              productNameMain: '$productNameMain',
              productNameSub: '$productNameSub',
              category: '$category',
              price: '$price',
              inStock: '$inStock',
              enable: '$enable',
              mainPhoto: '$mainPhoto'
            },
            quantity: '$quantity',
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

  const result = data[0] || {
    products: [],
    summary: {
      totalQuantity: 0,
      grandTotal: 0
    }
  }

  return res.status(200).json({
    status: 'success',
    msg: '查詢成功',
    data: result
  })
})

// 移除該購物車項目 (前台)
/**
 * @param {string} req.user._id
 * @param {string} req.body.cartId
 */
exports.deleteCart = catchError(async (req, res, next) => {
  const userId = validateObjectId(req.user._id, res)
  const cartId = validateObjectId(req.body.cartId, res)

  const Carts = collection('carts')

  const deleteResult = await Carts.deleteOne({ _id: cartId, userId })

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
/**
 * @param {string} req.user._id
 */
exports.clearMyCarts = catchError(async (req, res, next) => {
  const userId = validateObjectId(req.user._id, res)

  const Carts = collection('carts')
  await Carts.deleteMany({ userId })

  return res.status(200).json({
    status: 'success',
    msg: '已清空購物車'
  })
})
