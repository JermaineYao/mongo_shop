const express = require('express')
const multer = require('multer')
const product = require('../controller/productController')

const { routerGuardAdmin } = require('../controller/authController')

const router = express.Router()
const upload = multer().any()

// // 新增產品
// router.post('/add_product_admin', routerGuardAdmin, product.addProductAdmin)

// // 檢查產品名稱是否可用
// router.post('/check_product_name_admin', product.checkProductNameAdmin)

// // 查看單一產品(前台)
// router.get('/:productId', product.findOneProduct)
// // 查看單一產品(後台)
// router.get(
//   '/product_admin/:productId',
//   routerGuardAdmin,
//   product.findOneProductAdmin
// )

// // 查詢所有商品(前台)
// router.post('/all', product.findAllProducts)
// // 查詢所有商品(後台)
// router.post('/all_admin', routerGuardAdmin, product.findAllProductsAdmin)

// // 修改產品(後台)
// router.post('/modify', routerGuardAdmin, product.updateProductAdmin)

// // 啟用, 停用商品
// router.post('/enable', routerGuardAdmin, product.enableSwitchProductAdmin)

// // 上傳主要圖片(後台)
// router.post(
//   '/upload_main_photo_admin',
//   upload,
//   routerGuardAdmin,
//   product.uploadProductMainPhotoAdmin
// )
// // 上傳次要圖片(後台)
// router.post(
//   '/upload_sub_photo_admin',
//   upload,
//   routerGuardAdmin,
//   product.uploadProductSubPhotoAdmin
// )

// // 刪除主要圖片(後台)
// router.post(
//   '/delete_main_photo_admin',
//   routerGuardAdmin,
//   product.deleteProductMainPhotoAdmin
// )
// // 刪除次要圖片(後台)
// router.post(
//   '/delete_sub_photo_admin',
//   routerGuardAdmin,
//   product.deleteProductSubPhotoAdmin
// )

// // 刪除商品(後台)
// router.post('/delete_product', routerGuardAdmin, product.deleteProductAdmin)

// module.exports = router

// 新增產品
router.post('/add_product_admin', product.addProductAdmin)

// 檢查產品名稱是否可用
router.post('/check_product_name_admin', product.checkProductNameAdmin)

// 查看單一產品(前台)
router.get('/:productId', product.findOneProduct)
// 查看單一產品(後台)
router.get('/product_admin/:productId', product.findOneProductAdmin)

// 查詢所有商品(前台)
router.post('/all', product.findAllProducts)
// 查詢所有商品(後台)
router.post('/all_admin', product.findAllProductsAdmin)

// 修改產品(後台)
router.post('/modify', product.updateProductAdmin)

// 啟用, 停用商品
router.post('/enable', product.enableSwitchProductAdmin)

// 上傳主要圖片(後台)
router.post(
  '/upload_main_photo_admin',
  upload,
  product.uploadProductMainPhotoAdmin
)
// 上傳次要圖片(後台)
router.post(
  '/upload_sub_photo_admin',
  upload,
  product.uploadProductSubPhotoAdmin
)

// 刪除主要圖片(後台)
router.post('/delete_main_photo_admin', product.deleteProductMainPhotoAdmin)
// 刪除次要圖片(後台)
router.post('/delete_sub_photo_admin', product.deleteProductSubPhotoAdmin)

// 刪除商品(後台)
router.post('/delete_product', product.deleteProductAdmin)

module.exports = router
