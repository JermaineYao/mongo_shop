const express = require('express')
const multer = require('multer')
const user = require('../controller/userController')

const {
  routerGuard,
  routerGuardAdmin,
  isUserActive
} = require('../controller/authController')

const router = express.Router()
const upload = multer().any()

// 註冊前檢查帳號 信箱是否已被使用(前台)
router.post('/check_user', user.checkIfAccountExists)
// 註冊前檢查帳號 信箱是否已被使用(後台)
router.post(
  '/check_user_admin',
  routerGuardAdmin,
  isUserActive(),
  user.checkIfAccountAdminExists
)

// 註冊(前台)
router.post('/sign_up', user.signup)

// 新增帳號(後台)
router.post(
  '/add_user_admin',
  routerGuardAdmin,
  isUserActive(),
  user.addUserAdmin
)

// 登入(前台)
router.post('/sign_in', user.signIn)
// 登入(後台)
router.post('/sign_in_admin', user.signInAdmin)

// 登出(前台)
router.post('/sign_out', user.signout)
// 登出(後台)
router.post('/sign_out_admin', user.signoutAdmin)

// 檢查是否登入(前台)
router.get('/is_login', user.isLogin)
// 檢查是否登入(後台)
router.get('/is_login_admin', user.isLoginAdmin)

// 修改密碼 (前台)
router.patch('/update_pwd', routerGuard, user.updatePwd)
// 修改密碼 (後台)
router.patch('/update_pwd_admin', routerGuardAdmin, user.updatePwdAdmin)

// 忘記密碼(發送密碼設定連結至用戶信箱)(前台)
router.post('/forgot_pwd', user.forgotPWD)
// 忘記密碼(發送密碼設定連結至用戶信箱)(後台)
router.post('/forgot_pwd_admin', user.forgotPWDAdmin)

// 忘記密碼 - 設定新密碼(前台)
router.post('/reset_pwd', user.resetPWD)
// 忘記密碼 - 設定新密碼(後台)
router.post('/reset_pwd_admin', user.resetPWDAdmin)

// 取得所有帳號(後台)
router.post('/all', routerGuardAdmin, isUserActive(), user.findAllUsers)

// 查詢我的帳號(前台)
router.get('/my_account', routerGuard, user.myAccount)
// 查詢我的帳號(後台)
router.get('/my_account_admin', routerGuardAdmin, user.myAccount)
// 查詢單一帳號(後台)
router.post('/query_user', routerGuardAdmin, isUserActive(), user.findUserAdmin)

// 停用,啟用 帳號(前台)
router.patch('/my_account_enable', routerGuard, user.enableSwitchUser)
// 停用,啟用 帳號(後台)
router.patch('/user_enable_admin', routerGuardAdmin, user.enableSwitchUserAdmin)

// 更新 user (地址, 電話)(前台)
router.patch('/update_my_contact', routerGuard, user.updateUser)
// 更新 user (地址, 電話)(後台)
router.patch('/update_user_info_admin', routerGuardAdmin, user.updateUserAdmin)

// 上傳,更新照片 (前台)
router.post('/upload_user_photo', upload, routerGuard, user.updateUserPhoto)
// 上傳,更新照片 (後台)
router.post(
  '/upload_user_photo_admin',
  upload,
  routerGuardAdmin,
  user.updateUserPhotoAdmin
)

// 刪除照片(前台)
router.delete('/delete_my_photo', routerGuard, user.deleteUserPhoto)
// 刪除照片(後台)
router.delete(
  '/delete_user_photo_admin/:userId',
  routerGuardAdmin,
  isUserActive(),
  user.deleteUserPhotoAdmin
)

module.exports = router
