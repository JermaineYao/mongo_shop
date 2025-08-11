const { collection, collectionExists, DB } = require('../utils/db')
const { catchError } = require('../utils/catchError')

const { productJsonSchema } = require('../schema/product/mongoSchema')
const {
  createProducSchema,
  checkProductSchema,
  updateProductSchema
} = require('../schema/product/zodSchema')

const {
  formatDateTimeTW,
  getTaiwanTimestamp,
  validateObjectId,
  renameId
} = require('../utils/utils.js')

const {
  uploadFileToAWS,
  deleteFileFromAWS,
  getAWSImageUrl
} = require('../utils/aws')

/*============= 新增商品 =============*/
// 新增產品
exports.addProductAdmin = catchError(async (req, res, next) => {
  await checkOrCreateProduct('create', res, res)
})

// 檢查產品名稱是否已被使用
exports.checkProductNameAdmin = catchError(async (req, res, next) => {
  await checkOrCreateProduct('check', res, res)
})

async function checkOrCreateProduct(mode, req, res) {
  const productsExist = await collectionExists('products')
  if (!productsExist) {
    await db.createCollection('products', {
      validator: productJsonSchema
    })

    await db
      .collection('products')
      .createIndex({ nameMain: 1, nameSub: 1 }, { unique: true })
  }

  const schema = mode === 'create' ? createProducSchema : checkProductSchema
  const parsedData = schemaValidator(res, schema, req.body)
  if (!parsedData) return

  const { nameMain, nameSub } = parsedData

  const Products = collection('products')

  const [productByNameMain, productByNameSub] = await Promise.all([
    Products.findOne({ nameMain }),
    Products.findOne({ nameSub })
  ])

  if (productByNameMain || productByNameSub) {
    if (mode === 'check') {
      return { status: 'failed', msg: '主名稱或副名稱已被使用', code: 409 }
    } else {
      return res
        .status(409)
        .json({ status: 'failed', msg: '主名稱或副名稱已被使用' })
    }
  }

  if (mode === 'check') return { status: 'success', msg: '可使用' }

  const now = formatDateTimeTW()
  const { category, price, size, description, inStock } = parsedData

  const result = await Products.insertOne({
    nameMain,
    nameSub,
    category,
    price,
    size,
    inStock,
    description,
    enable: false,
    mainPhoto: {
      createAt: null,
      fileKey: null,
      url: null,
      description: null
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
    msg: '新增成功',
    data
  })
}

/*============= 修改商品 =============*/
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
exports.enableSwitchProductAdmin = catchError(async (req, res, next) => {
  const id = validateObjectId(req.body.productId, res)
  const enable = req.body.enable ? req.body.enable : false
  const msgFailedStr = req.body.enable ? '啟用失敗' : '停用失敗'
  const msgSuccessStr = req.body.enable ? '已啟用' : '已停用'

  // 必須有商品照片才可以啟用
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

  // 查詢商品是否存在
  const Products = collection('products')
  const product = await Products.findOne({ _id: id })
  if (!product) {
    return res.status(404).json({ status: 'failed', msg: '商品不存在' })
  }

  // 移除主要圖片
  if (product.mainPhoto.fileKey !== null) {
    const { deleteResult, errMsg } = await deleteFileFromAWS(toBeDeleted)

    if (!deleteResult) {
      return res.status(200).json({
        status: 'success',
        msg: '刪除舊照片失敗',
        deleteError: errMsg
      })
    }
  }

  // 移除次要圖片

  // 從我的最愛刪除

  // 從購物車刪除

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
exports.findProduct = catchError(async (req, res, next) => {
  const id = validateObjectId(req.body.productId, res)

  const Products = collection('products')
  const product = await Products.findOne(
    { _id: id, enable: true },
    { projection: { enable: 0 } }
  )

  if (!product) {
    return res.status(404).json({ status: 'failed', msg: '商品不存在' })
  }

  const data = renameId('productId', product)
  return res.status(200).json({ status: 'success', msg: '查詢成功', data })
})

// 查詢單一商品(後台)
exports.findProductAdmin = catchError(async (req, res, next) => {
  const id = validateObjectId(req.body.productId, res)

  const Products = collection('products')
  const product = await Products.findOne({ _id: id })
  if (!product) {
    return res.status(404).json({ status: 'failed', msg: '商品不存在' })
  }

  const data = renameId('productId', product)
  return res.status(200).json({ status: 'success', msg: '查詢成功', data })
})

/*============= 主要圖片 =============*/

async function uploadProductMainPhotoObj(req, res) {
  const description = (req.body.description ?? '').trim()
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
      createAt: formatDateTimeTW(),
      fileKey,
      url: getAWSImageUrl(fileKey),
      description
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
    return res.status(404).json({ status: 'failed', msg: '照片更新失敗' })
  }

  const data = renameId('productId', productUpdated)

  // 刪除 product 原有的圖片
  const toBeDeleted = product.mainPhoto.fileKey

  if (!toBeDeleted) {
    return res.status(200).json({
      status: 'success',
      mas: '上傳照片完成',
      data
    })
  }

  const { deleteResult, errMsg } = await deleteFileFromAWS(toBeDeleted)

  if (!deleteResult) {
    return res.status(200).json({
      status: 'success',
      msg: '上傳成功，但刪除舊照片失敗',
      data,
      deleteError: errMsg
    })
  }

  return res.status(200).json({
    status: 'success',
    msg: '上傳照片完成',
    data
  })
}

async function uploadProductSubPhotoObj(req, res) {}

async function deleteProductMainPhotoObj(req, res) {
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
      msg: '沒有照片'
    })
  }

  const { deleteResult, errMsg } = await deleteFileFromAWS(toBeDeleted)
  if (!deleteResult) {
    return res.status(200).json({
      status: 'success',
      msg: 'S3 刪除照片失敗',
      deleteError: errMsg
    })
  }

  const deleteCondition = {
    enable: false,
    mainPhoto: {
      createAt: null,
      fileKey: null,
      url: null,
      description: null
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
    return res.status(202).json({
      status: 'success',
      msg: '資料無變動（可能已為空）'
    })
  }

  return res.status(200).json({
    status: 'success',
    msg: '已刪除照片',
    data: deleteCondition
  })
}
