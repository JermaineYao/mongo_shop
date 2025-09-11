const express = require('express')
const multer = require('multer')
const product = require('../controller/productController')

const {
  routerGuardAdmin,
  isUserActive
} = require('../controller/authController')

const router = express.Router()
const upload = multer().any()

// 新增產品
router.post(
  '/add_product_admin',
  routerGuardAdmin,
  isUserActive(),
  product.addProductAdmin
)

// 檢查產品名稱是否可用
router.post(
  '/check_product_name_admin',
  routerGuardAdmin,
  isUserActive(),
  product.checkProductNameAdmin
)

// 查看單一產品(前台)
router.get('/:productId', product.findOneProduct)
// 查看單一產品(後台)
router.get(
  '/product_admin/:productId',
  routerGuardAdmin,
  isUserActive(),
  product.findOneProductAdmin
)

// 查詢所有商品(前台)
router.post('/all', product.findAllProducts)
// 查詢所有商品(後台)
router.post(
  '/all_admin',
  routerGuardAdmin,
  isUserActive(),
  product.findAllProductsAdmin
)

// 修改產品(後台)
router.patch(
  '/modify',
  routerGuardAdmin,
  isUserActive(),
  product.updateProductAdmin
)

// 啟用, 停用商品
router.patch(
  '/enable',
  routerGuardAdmin,
  isUserActive(),
  product.enableSwitchProductAdmin
)

// 上傳主要圖片(後台)
router.post(
  '/upload_main_photo_admin',
  upload,
  routerGuardAdmin,
  isUserActive(),
  product.uploadProductMainPhotoAdmin
)
// 上傳次要圖片(後台)
router.post(
  '/upload_sub_photo_admin',
  upload,
  routerGuardAdmin,
  isUserActive(),
  product.uploadProductSubPhotoAdmin
)

// 刪除主要圖片(後台)
router.post(
  '/delete_main_photo_admin',
  routerGuardAdmin,
  isUserActive(),
  product.deleteProductMainPhotoAdmin
)
// 刪除次要圖片(後台)
router.post(
  '/delete_sub_photo_admin',
  routerGuardAdmin,
  isUserActive(),
  product.deleteProductSubPhotoAdmin
)

// 刪除商品(後台)
router.post(
  '/delete_product',
  routerGuardAdmin,
  isUserActive(),
  product.deleteProductAdmin
)

module.exports = router
