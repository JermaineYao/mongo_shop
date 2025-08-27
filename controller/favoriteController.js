const { collection, collectionExists, DB } = require('../utils/db')
const { catchError } = require('../utils/catchError')

const { favoriteJsonSchema } = require('../schema/favorite/mongoSchema')
const { createFavoriteSchema } = require('../schema/favorite/zodSchema')
const { schemaValidator } = require('../utils/schemaValidator')

const { validateObjectId } = require('../utils/utils')

// 新增,移除 我的最愛 (前台)
exports.toggleFavorite = catchError(async (req, res, next) => {
  const favoritesExist = await collectionExists('favorites')

  if (!favoritesExist) {
    const db = DB()

    await db.createCollection('favorites', {
      validator: favoriteJsonSchema
    })

    await db
      .collection('favorites')
      .createIndex({ userId: 1, productId: 1 }, { unique: true })
  }

  const parsedData = schemaValidator(res, createFavoriteSchema, {
    productId: req.body.productId,
    // userId: req.user._id
    userId: req.body.userId
  })
  if (!parsedData) return

  const Products = collection('products')
  const Favorites = collection('favorites')
  const now = new Date()
  const userId = validateObjectId(parsedData.userId)
  const productId = validateObjectId(parsedData.productId)

  const product = await Products.findOne({ _id: productId })
  if (!product) {
    return res.status(404).json({ status: 'failed', msg: '商品已下架' })
  }

  // 是否已在我的最愛中
  const favorite = await Favorites.findOne({ userId, productId })

  // 不存在 -> 新增
  if (!favorite) {
    const result = await Favorites.insertOne({
      userId,
      productId,
      addedAt: now
    })

    if (!result.acknowledged) {
      return res.status(500).json({
        status: 'failed',
        msg: '我的最愛新增失敗，請稍後再試'
      })
    }

    return res.status(201).json({
      status: 'success',
      msg: '新增至我的最愛'
    })
  }

  // 存在 -> 移除
  const deleteResult = await Favorites.deleteOne({ _id: favorite._id })

  if (deleteResult.deletedCount === 0) {
    return res.status(404).json({
      status: 'failed',
      msg: '從我的最愛移除失敗'
    })
  }

  return res.status(200).json({
    status: 'success',
    msg: '已從我的最愛中移除'
  })
})

// 查詢我的最愛
exports.findFavorites = catchError(async (req, res, next) => {
  const userId = validateObjectId(req.body.userId, res)
  // const userId = validateObjectId(req.user._id, res)

  const Favorites = collection('favorites')

  const data = await Favorites.aggregate([
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
      $project: {
        _id: 0,
        favoriteId: '$_id', // Favorites 的 _id
        productId: '$product._id', // product 的 _id
        productNameMain: '$product.productNameMain',
        productNameSub: '$product.productNameSub',
        category: '$product.category',
        price: '$product.price',
        inStock: '$product.inStock',
        enable: '$product.enable',
        mainPhoto: '$product.mainPhoto'
      }
    }
  ]).toArray()

  return res.status(200).json({
    status: 'success',
    msg: '查詢成功',
    data
  })
})

// 清空我的最愛
exports.clearMyFavorites = catchError(async (req, res, next) => {
  const userId = validateObjectId(req.body.userId, res)
  // const userId = validateObjectId(req.user._id, res)

  const Favorites = collection('favorites')
  await Favorites.deleteMany({ userId })

  return res.status(200).json({
    status: 'success',
    msg: '已清空我的最愛'
  })
})
