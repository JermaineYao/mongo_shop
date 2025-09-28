const { ObjectId } = require('mongodb')

const { collection, collectionExists, DB } = require('../utils/db')
const { catchError } = require('../utils/catchError')

const { productJsonSchema } = require('../schema/product/mongoSchema')
const {
  createProductSchema,
  checkProductSchema,
  updateProductSchema
} = require('../schema/product/zodSchema')
const { schemaValidator } = require('../utils/schemaValidator')

const {
  validateObjectId,
  renameId,
  checkFileToBeUploaded
} = require('../utils/utils')
const SearchDoc = require('../utils/search')

const {
  uploadFileToAWS,
  deleteFileFromAWS,
  getAWSImageUrl
} = require('../utils/aws')

/*============= 新增商品 =============*/
// 新增產品
exports.addProductAdmin = catchError(async (req, res, next) => {
  await checkOrCreateProduct('create', req, res)
})

// 檢查產品名稱是否已被使用
exports.checkProductNameAdmin = catchError(async (req, res, next) => {
  await checkOrCreateProduct('check', req, res)
})

/**
 * 新增
 * @param {string} req.body.productNameMain
 * @param {string} req.body.productNameSub
 * @param {number} req.body.price
 * @param {string} req.body.category
 * @param {number} req.body.inStock
 * @param {array<string || null> || null || undefined} req.body.description
 *
 * 檢查 (account, email 至少給一個)
 * @param {string} req.body.productNameMain
 * @param {string} req.body.productNameSub
 */
async function checkOrCreateProduct(mode, req, res) {
  const productsExist = await collectionExists('products')

  if (!productsExist) {
    const db = DB()

    await db.createCollection('products', {
      validator: productJsonSchema
    })

    await db
      .collection('products')
      .createIndex({ productNameMain: 1, productNameSub: 1 }, { unique: true })
  }

  const schema = mode === 'create' ? createProductSchema : checkProductSchema
  const parsedData = schemaValidator(res, schema, req.body)
  if (!parsedData) return

  const { productNameMain, productNameSub } = parsedData

  const Products = collection('products')

  const [productByNameMain, productByNameSub] = await Promise.all([
    Products.findOne({ productNameMain }),
    Products.findOne({ productNameSub })
  ])

  if (productByNameMain) {
    if (mode === 'check') {
      return res
        .status(409)
        .json({ status: 'failed', msg: '商品主名稱已被使用', code: 409 })
    } else {
      return res
        .status(409)
        .json({ status: 'failed', msg: '商品主名稱已被使用' })
    }
  }

  if (productByNameSub) {
    if (mode === 'check') {
      return res
        .status(409)
        .json({ status: 'failed', msg: '商品副名稱已被使用', code: 409 })
    } else {
      return res
        .status(409)
        .json({ status: 'failed', msg: '商品副名稱已被使用' })
    }
  }

  if (mode === 'check')
    return res.status(200).json({ status: 'success', msg: '商品名稱可使用' })

  const now = new Date()
  const { category, price, size, description, inStock } = parsedData

  const result = await Products.insertOne({
    productNameMain,
    productNameSub,
    category,
    price,
    size,
    inStock,
    description,
    enable: false,
    mainPhoto: {
      createAt: null,
      fileKey: null,
      url: null
    },
    subPhotos: [],
    createAt: now
  })

  if (!result.acknowledged) {
    return res.status(500).json({
      status: 'failed',
      msg: '商品新增失敗，請稍後再試'
    })
  }

  const newProduct = await Products.findOne({ _id: result.insertedId })
  const data = renameId('productId', newProduct)

  return res.status(201).json({
    status: 'success',
    msg: '新增商品成功',
    data
  })
}

/*============= 修改商品 =============*/
// 修改商品內容 (圖片資訊, 啟用除外)
/**
 * @param {string} req.body.procudtId
 * @param {string} req.body.category
 * @param {number} req.body.price
 * @param {string} req.body.size
 * @param {array<string || null> || null || undefined} req.body.description
 * @param {number} req.body.inStock
 */
exports.updateProductAdmin = catchError(async (req, res, next) => {
  const parsedData = schemaValidator(res, updateProductSchema, req.body)
  if (!parsedData) return

  const { productId, ...payload } = parsedData
  const id = validateObjectId(productId, res)
  const Products = collection('products')

  const product = await Products.findOne({ _id: id })

  if (!product) {
    return res.status(404).json({ status: 'failed', msg: '商品不存在' })
  }

  const productUpdated = await Products.findOneAndUpdate(
    { _id: id },
    { $set: payload },
    { returnDocument: 'after' }
  )

  if (!productUpdated) {
    return res.status(404).json({ status: 'failed', msg: '修改商品失敗' })
  }

  const data = renameId('productId', productUpdated)
  return res.status(200).json({ status: 'success', msg: '修改商品成功', data })
})

/*============= 啟用/停用, 刪除 商品 =============*/
// 啟用, 停用商品
/**
 * @param {string} req.body.procudtId
 * @param {boolean || null} req.body.enbale
 */
exports.enableSwitchProductAdmin = catchError(async (req, res, next) => {
  const id = validateObjectId(req.body.productId, res)
  const enable = req.body.enable ? req.body.enable : false
  const msgFailedStr = req.body.enable
    ? '啟用失敗 請檢查是否有商品主要圖片'
    : '停用失敗'
  const msgSuccessStr = req.body.enable ? '已啟用' : '已停用'

  // 必須有商品圖片才可以啟用
  const filter = enable
    ? { _id: id, 'mainPhoto.fileKey': { $ne: null } }
    : { _id: id }

  const Products = collection('products')
  const productUpdated = await Products.findOneAndUpdate(
    filter,
    { $set: { enable } },
    { returnDocument: 'after' }
  )

  if (!productUpdated) {
    return res.status(404).json({ status: 'failed', msg: msgFailedStr })
  }

  const data = renameId('productId', productUpdated)
  return res.status(200).json({ status: 'success', msg: msgSuccessStr, data })
})

// 刪除商品(後台)
exports.deleteProductAdmin = catchError(async (req, res, next) => {
  const id = validateObjectId(req.body.productId, res)
  // 檢查帳單是否有此商品
  const Orders = collection('orders')
  const count = await Orders.countDocuments({
    status: { $in: ['pending', 'shipping', 'completed'] },
    'productsOrdered.productId': id
  })

  if (count > 0) {
    return res.status(409).json({
      status: 'failed',
      msg: '訂單中有此商品，不能刪除（請改為下架）',
      count
    })
  }

  // 查詢商品是否存在
  const Products = collection('products')
  const product = await Products.findOne({ _id: id })
  if (!product) {
    return res.status(404).json({ status: 'failed', msg: '商品不存在' })
  }

  // 移除主要圖片 (不刪除, 訂單快照需要)
  // if (product.mainPhoto.fileKey !== null) {
  //   const { deleteResult, errMsg } = await deleteFileFromAWS(
  //     product.mainPhoto.fileKey
  //   )

  //   if (!deleteResult) {
  //     return res.status(200).json({
  //       status: 'success',
  //       msg: '刪除舊主要圖片失敗',
  //       deleteError: errMsg
  //     })
  //   }
  // }

  // 移除次要圖片
  if (Array.isArray(product.subPhotos) && product.subPhotos.length > 0) {
    for (const sub of product.subPhotos) {
      if (sub.fileKey) {
        const { deleteResult, errMsg } = await deleteFileFromAWS(sub.fileKey)

        if (!deleteResult) {
          return res.status(200).json({
            status: 'success',
            msg: '刪除舊次要圖片失敗',
            deleteError: errMsg,
            subPhotoId: sub.subPhotoId,
            fileKey: sub.fileKey
          })
        }
      }
    }
  }

  // 從我的最愛刪除
  const favoritesExist = await collectionExists('favorites')
  if (favoritesExist) {
    const Favorites = collection('favorites')
    await Favorites.deleteMany({ productId: id })
  }

  // 從購物車刪除
  const cartsExist = await collectionExists('carts')
  if (cartsExist) {
    const Carts = collection('carts')
    await Carts.deleteMany({ productId: id })
  }

  // 刪除此商品
  const result = await Products.deleteOne({ _id: id })

  if (result.deletedCount === 0) {
    return res.status(404).json({
      status: 'failed',
      msg: '找不到該商品，刪除失敗'
    })
  }

  return res.status(200).json({
    status: 'success',
    msg: '刪除成功'
  })
})

/*============= 查詢 =============*/
// 查詢單一商品(前台)
exports.findOneProduct = catchError(async (req, res, next) => {
  await findOne(req, res)
})

// 查詢單一商品(後台)
exports.findOneProductAdmin = catchError(async (req, res, next) => {
  await findOne(req, res, 'admin')
})

/**
 * @param {string} req.params.procudtId
 */
async function findOne(req, res, reqFrom = 'front') {
  const id = validateObjectId(req.params.productId, res)
  const userId = req.user ? new ObjectId(req.user._id) : null

  const queryCondition =
    reqFrom === 'front' ? { _id: id, enable: true } : { _id: id }

  const Products = collection('products')
  const product = await Products.findOne(queryCondition)

  if (!product) {
    return res.status(404).json({ status: 'failed', msg: '商品不存在' })
  }

  const data = renameId('productId', product)

  if (userId) {
    const Favorites = collection('favorites')
    const Carts = collection('carts')

    const [favoriteRaw, cartRaw] = await Promise.all([
      Favorites.findOne(
        { userId, productId: id },
        { projection: { productId: 1 } }
      ),
      Carts.findOne({ userId, productId: id }, { projection: { productId: 1 } })
    ])

    console.log(favoriteRaw, cartRaw)

    return res.status(200).json({
      status: 'success',
      msg: '查詢成功',
      data: {
        ...data,
        addedToCart: cartRaw ? true : false,
        addedToFavorite: favoriteRaw ? true : false
      }
    })
  }

  return res.status(200).json({ status: 'success', msg: '查詢成功', data })
}

// 查詢所有商品(前台)
exports.findAllProducts = catchError(async (req, res, next) => {
  const userId = req.user ? new ObjectId(req.user._id) : null

  const queryCondition = normalizeQuery(req.query)
  queryCondition.enable = true

  const productsRaw = new SearchDoc('products', queryCondition, {
    productNameMain: 1,
    productNameSub: 1,
    category: 1,
    price: 1,
    inStock: 1,
    mainPhoto: 1
  })
  const dataCount = await productsRaw.countDocuments()
  const products = await productsRaw
    .filter()
    .sort()
    .limitFields()
    .pagination()
    .exec()
  const totalPages =
    productsRaw.limit > 0 ? Math.ceil(dataCount / productsRaw.limit) : 1

  if (userId) {
    const Favorites = collection('favorites')
    const Carts = collection('carts')

    const [favoriteRaw, cartRaw] = await Promise.all([
      Favorites.find({ userId }, { projection: { productId: 1 } }).toArray(),
      Carts.find({ userId }, { projection: { productId: 1 } }).toArray()
    ])

    const favSet = new Set(favoriteRaw.map((f) => f.productId.toString()))
    const cartSet = new Set(cartRaw.map((f) => f.productId.toString()))

    const data = products.map((p) => {
      const pid = p._id.toString()

      return {
        ...p,
        addedToFavorite: favSet.has(pid),
        addedToCart: cartSet.has(pid)
      }
    })

    return res.status(200).json({
      status: 'success',
      data,
      dataCount,
      totalPages,
      page: productsRaw.currentPage,
      limit: productsRaw.limit
    })
  }

  return res.status(200).json({
    status: 'success',
    data: products,
    dataCount,
    totalPages,
    page: productsRaw.currentPage,
    limit: productsRaw.limit
  })
})

function normalizeQuery(q) {
  const out = { ...q }

  // page / currentPage / limit 轉數字
  if (out.currentPage != null) out.currentPage = parseInt(out.currentPage, 10)
  if (out.page != null) {
    out.currentPage = parseInt(out.page, 10)
    delete out.page
  }

  if (out.limit != null) out.limit = parseInt(out.limit, 10)
  if (out.price != null && typeof out.price === 'string')
    out.price = JSON.parse(out.price)

  // fields 可接受：JSON 陣列字串 或 逗點字串
  if (typeof out.fields === 'string') {
    const s = out.fields.trim()
    if (s.startsWith('[')) {
      out.fields = JSON.parse(s)
    } else if (s.includes(',')) {
      out.fields = s
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    }
  }

  // sort 可接受：JSON 物件字串 或 "price,-createdAt"
  if (typeof out.sort === 'string') {
    const s = out.sort.trim()
    if (s.startsWith('{')) {
      out.sort = JSON.parse(s)
    } else if (s) {
      const obj = {}
      s.split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .forEach((k) => {
          if (k.startsWith('-')) obj[k.slice(1)] = -1
          else obj[k] = 1
        })
      out.sort = obj
    }
  }

  return out
}

// 查詢所有商品(後台)
exports.findAllProductsAdmin = catchError(async (req, res, next) => {
  const queryCondition = { ...req.body }

  const products = new SearchDoc('products', queryCondition)
  const dataCount = await products.countDocuments()
  const data = await products.filter().sort().limitFields().pagination().exec()
  const totalPages =
    products.limit > 0 ? Math.ceil(dataCount / products.limit) : 1

  return res.status(200).json({
    status: 'success',
    data,
    dataCount,
    totalPages,
    page: products.currentPage,
    limit: products.limit
  })
})

/*============= 圖片 =============*/
// 上傳主要圖片
/**
 * @param {string} req.body.procudtId
 * @param {binary} req.file
 */
exports.uploadProductMainPhotoAdmin = catchError(async (req, res, next) => {
  const productId = validateObjectId(req.body.productId, res)

  const { checkFileResult, fileType, file } = checkFileToBeUploaded(req, res)
  if (!checkFileResult) return

  // 確認商品存在
  const Products = collection('products')
  const product = await Products.findOne({ _id: productId })
  if (!product) {
    return res.status(404).json({ status: 'failed', msg: '商品不存在' })
  }

  // 透過後端取得 persignedUrl, 然後上傳檔案至 S3
  const { uploadResult, fileKey } = await uploadFileToAWS(res, {
    target: 'mainPhoto',
    prefixId: productId,
    fileType,
    file
  })
  if (!uploadResult) return

  // 更新 product 文檔
  const updateContent = {
    mainPhoto: {
      createAt: new Date(),
      fileKey,
      url: getAWSImageUrl(fileKey)
    }
  }

  const productUpdated = await Products.findOneAndUpdate(
    { _id: productId },
    { $set: updateContent },
    {
      projection: {
        mainPhoto: 1
      },
      returnDocument: 'after'
    }
  )

  if (!productUpdated) {
    return res.status(404).json({ status: 'failed', msg: '圖片更新失敗' })
  }

  const data = renameId('productId', productUpdated)

  // 若訂單中無此商品, 刪除 product 原有的圖片
  const Orders = collection('orders')
  const orderCount = await Orders.countDocuments({
    status: { $in: ['pending', 'shipping', 'completed'] },
    'productsOrdered.productId': productId
  })

  if (orderCount === 0) {
    const toBeDeleted = product.mainPhoto.fileKey

    if (!toBeDeleted) {
      return res.status(200).json({
        status: 'success',
        msg: '上傳圖片完成',
        data
      })
    }

    const { deleteResult, errMsg } = await deleteFileFromAWS(toBeDeleted)

    if (!deleteResult) {
      return res.status(200).json({
        status: 'success',
        msg: '上傳成功，但刪除舊圖片失敗',
        data,
        deleteError: errMsg
      })
    }
  }

  return res.status(200).json({
    status: 'success',
    msg: '上傳圖片完成',
    data
  })
})

// 上傳次要圖片
/**
 * @param {string} req.body.procudtId
 * @param {string || null} req.body.subPhotoId
 * @param {binary} req.file
 */
exports.uploadProductSubPhotoAdmin = catchError(async (req, res, next) => {
  const productId = validateObjectId(req.body.productId, res)
  const rawSubPhotoId = req.body.subPhotoId
  const subPhotoId =
    rawSubPhotoId && rawSubPhotoId !== 'null'
      ? validateObjectId(rawSubPhotoId, res)
      : new ObjectId()

  const hasSubPhoto = rawSubPhotoId && rawSubPhotoId !== 'null' ? true : false

  const { checkFileResult, fileType, file } = checkFileToBeUploaded(req, res)
  if (!checkFileResult) return

  // 確認商品存在
  const Products = collection('products')
  const product = await Products.findOne(
    { _id: productId },
    { projection: { _id: 1, subPhotos: 1 } }
  )
  if (!product)
    return res.status(404).json({ status: 'failed', msg: '商品不存在' })

  // 取得目前 subPhoto
  let currentSubPhoto = null
  if (hasSubPhoto) {
    currentSubPhoto = (product.subPhotos || []).find((p) =>
      p.subPhotoId?.equals
        ? p.subPhotoId.equals(subPhotoId)
        : p.subPhotoId === subPhotoId
    )

    if (!currentSubPhoto) {
      return res.status(404).json({ status: 'failed', msg: '次要圖片不存在' })
    }
  }

  // 透過後端取得 persignedUrl, 然後上傳檔案至 S3
  const { uploadResult, fileKey } = await uploadFileToAWS(res, {
    target: 'subPhoto',
    prefixId: productId,
    fileType,
    file
  })
  if (!uploadResult) return

  const subDoc = {
    subPhotoId,
    createAt: new Date(),
    fileKey,
    url: getAWSImageUrl(fileKey)
  }

  if (!hasSubPhoto) {
    // 要新增 subPhoto
    const filter = {
      _id: productId,
      subPhotos: { $not: { $elemMatch: { subPhotoId } } }
    }

    const productUpdated = await Products.findOneAndUpdate(
      filter,
      {
        $push: { subPhotos: subDoc }
      },
      {
        returnDocument: 'after'
      }
    )

    if (!productUpdated) {
      await deleteFileFromAWS(fileKey)

      return res.status(404).json({ status: 'failed', msg: '次要圖片新增失敗' })
    }

    return res.status(200).json({
      status: 'success',
      msg: '新增次要圖片完成',
      data: { productId, ...subDoc }
    })
  }

  if (hasSubPhoto) {
    // 更新 subPhoto
    const productUpdated = await Products.findOneAndUpdate(
      {
        _id: productId,
        'subPhotos.subPhotoId': subPhotoId
      },
      {
        $set: {
          'subPhotos.$.fileKey': fileKey,
          'subPhotos.$.url': subDoc.url,
          'subPhotos.$.createAt': subDoc.createAt
        }
      },
      {
        returnDocument: 'after'
      }
    )

    if (!productUpdated) {
      return res.status(404).json({ status: 'failed', msg: '次要圖片新增失敗' })
    }

    // 刪除 subPhoto 原有的圖片
    const toBeDeleted = currentSubPhoto.fileKey
    const { deleteResult, errMsg } = await deleteFileFromAWS(toBeDeleted)

    if (!deleteResult) {
      return res.status(200).json({
        status: 'success',
        msg: '更新圖片成功，但刪除舊圖片失敗',
        data: { productId, ...subDoc },
        deleteError: errMsg
      })
    }

    return res.status(200).json({
      status: 'success',
      msg: '上傳圖片完成',
      data: { productId, ...subDoc }
    })
  }
})

// 刪除主要圖片
/**
 * @param {string} req.body.procudtId
 */
exports.deleteProductMainPhotoAdmin = catchError(async (req, res, next) => {
  const productId = validateObjectId(req.body.productId, res)

  const Products = collection('products')
  const product = await Products.findOne({ _id: productId })
  if (!product) {
    return res.status(404).json({ status: 'failed', msg: '商品不存在' })
  }

  // 刪除 product 原有的圖片
  const toBeDeleted = product.mainPhoto?.fileKey

  if (!toBeDeleted) {
    return res.status(404).json({
      status: 'success',
      msg: '沒有圖片'
    })
  }

  const { deleteResult, errMsg } = await deleteFileFromAWS(toBeDeleted)
  if (!deleteResult) {
    return res.status(424).json({
      status: 'failed',
      msg: 'S3 刪除圖片失敗',
      deleteError: errMsg
    })
  }

  const deleteCondition = {
    enable: false,
    mainPhoto: {
      createAt: null,
      fileKey: null,
      url: null
    }
  }

  const deletedPhotoResult = await Products.updateOne(
    { _id: productId },
    { $set: deleteCondition }
  )

  if (deletedPhotoResult.matchedCount === 0) {
    return res.status(404).json({
      status: 'failed',
      msg: '找不到商品'
    })
  }

  if (deletedPhotoResult.modifiedCount === 0) {
    return res.status(422).json({
      status: 'failed',
      msg: '刪除主要圖片成功, 但是更新文檔失敗'
    })
  }

  return res.status(200).json({
    status: 'success',
    msg: '已刪除圖片',
    data: deleteCondition
  })
})

// 刪除次要圖片
/**
 * @param {string} req.body.procudtId
 * @param {string} req.body.subPhotoId
 * @param {string} req.body.fileKey
 */
exports.deleteProductSubPhotoAdmin = catchError(async (req, res, next) => {
  const productId = validateObjectId(req.body.productId, res)
  const subPhotoId = validateObjectId(req.body.subPhotoId, res)

  const fileKey = req.body.fileKey
  if (!fileKey) {
    return res.status(400).json({
      status: 'failed',
      msg: '未提供 fileKey'
    })
  }

  const Products = collection('products')
  const product = await Products.findOne(
    {
      _id: productId,
      'subPhotos.subPhotoId': subPhotoId
    },
    {
      projection: {
        subPhotos: 1
      }
    }
  )

  if (!product) {
    return res
      .status(404)
      .json({ status: 'failed', msg: '商品或次要圖片不存在' })
  }

  const { deleteResult, errMsg } = await deleteFileFromAWS(fileKey)
  if (!deleteResult) {
    return res.status(200).json({
      status: 'success',
      msg: 'S3 刪除圖片失敗',
      deleteError: errMsg
    })
  }

  const deletedPhotoResult = await Products.findOneAndUpdate(
    {
      _id: productId,
      'subPhotos.subPhotoId': subPhotoId
    },
    {
      $pull: {
        subPhotos: { subPhotoId: subPhotoId }
      }
    },
    {
      projection: { subPhotos: 1 },
      returnDocument: 'after'
    }
  )

  if (!deletedPhotoResult) {
    return res.status(422).json({
      status: 'failed',
      msg: '刪除次要圖片成功, 但是更新文檔失敗'
    })
  }

  return res.status(200).json({
    status: 'success',
    msg: '已刪除圖片',
    data: deletedPhotoResult
  })
})
