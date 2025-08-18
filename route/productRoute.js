const express = require('express')
const multer = require('multer')
const product = require('../controller/productController')

const {
  routerGuard,
  routerGuardAdmin,
  restrictTo
} = require('../controller/authController')

const router = express.Router()
const upload = multer().any()

// 新增產品
router.post('/add_product_admin', product.addProductAdmin)

// 檢查產品名稱是否可用
router.post('/check_product_name_admin', product.checkProductNameAdmin)

// 查看單一產品(前台)
router.get('/:productId', product.findPneProduct)

// 查看單一產品(後台)
router.get('/product_admin/:productId', product.findOneProductAdmin)

// 修改後台(後台)
router.post('/modify', product.updateProductAdmin)

// 上傳主要圖片(後台)
router.post(
  '/upload_main_photo_admin',
  upload,
  product.uploadProductMainPhotoAdmin
)

// 刪除主要圖片(後台)
router.post('/delete_main_photo_admin', product.deleteProductMainPhotoAdmin)

module.exports = router
