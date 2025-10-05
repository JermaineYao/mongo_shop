const { promisify } = require('util')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

const { collection, collectionExists, DB } = require('../utils/db')
const { catchError } = require('../utils/catchError')
const Email = require('../utils/email')

const {
  uploadFileToAWS,
  deleteFileFromAWS,
  getAWSImageUrl
} = require('../utils/aws')

const { userJsonSchema } = require('../schema/user/mongoSchema')
const {
  createUserSchema,
  checkUserSchema,
  loginSchema,
  updateUserSchema,
  forgotPWDSchema,
  checkPWDFromUrlUserSchema,
  changePwdlUserSchema
} = require('../schema/user/zodSchema')
const { schemaValidator } = require('../utils/schemaValidator')

const {
  getTaiwanTimestamp,
  validateObjectId,
  renameId,
  checkFileToBeUploaded
} = require('../utils/utils.js')
const SearchDoc = require('../utils/search')

/*============= 註冊 =============*/
// 註冊(前台)
exports.signup = catchError(async (req, res, next) => {
  await checkOrCreateUser('create', 'front', req, res)
})

// 新增帳號(後台)
exports.addUserAdmin = catchError(async (req, res, next) => {
  await checkOrCreateUser('create', 'admin', req, res)
})

// 檢查 帳號 或 EMAIL 是否已被使用 (前台)
exports.checkIfAccountExists = catchError(async (req, res, next) => {
  const result = await checkOrCreateUser('check', 'front', req, res)
  res.status(result.code || 200).json(result)
})

// 檢查 帳號 或 EMAIL 是否已被使用 (後台)
exports.checkIfAccountAdminExists = catchError(async (req, res, next) => {
  const result = await checkOrCreateUser('check', 'admin', req, res)
  res.status(result.code || 200).json(result)
})

// 建立 user schema 驗證規則
async function setUserValidator() {
  const db = DB()

  await db.createCollection('users', {
    validator: userJsonSchema
  })

  await db
    .collection('users')
    .createIndex({ account: 1, role: 1 }, { unique: true })

  await db
    .collection('users')
    .createIndex({ email: 1, role: 1 }, { unique: true })
}

// 統一處理註冊與帳號檢查
/**
 * 新增
 * @param {string} req.body.account
 * @param {string} req.body.email
 * @param {string} req.body.pwd
 * @param {string || null || undefined} req.body.phoneNumber
 * @param {string || null || undefined} req.body.address
 *
 * 檢查 (account, email 至少給一個)
 * @param {string} req.body.account
 * @param {string} req.body.email
 */
async function checkOrCreateUser(mode, reqFrom, req, res) {
  const role = reqFrom === 'admin' ? 'admin' : 'user'
  const UsersExist = await collectionExists('users')
  if (!UsersExist) {
    if (mode === 'check') return { status: 'success', msg: '可使用' }
    await setUserValidator()
  }

  if (reqFrom === 'admin' && mode === 'create') {
    req.body.pwd = '@Admin1234'
  }

  const schema = mode === 'create' ? createUserSchema : checkUserSchema
  const parsedData = schemaValidator(res, schema, req.body)
  if (!parsedData) return

  const { account, email, pwd, phoneNumber, address } = parsedData

  const Users = collection('users')

  const [userByAccount, userByEmail] = await Promise.all([
    Users.findOne({ account, role }),
    Users.findOne({ email, role })
  ])

  if (userByAccount || userByEmail) {
    if (mode === 'check') {
      return { status: 'failed', msg: '帳號或信箱已被使用', code: 409 }
    } else {
      return res
        .status(409)
        .json({ status: 'failed', msg: '帳號或信箱已被使用' })
    }
  }

  if (mode === 'check') return { status: 'success', msg: '可使用' }

  // 寫入資料庫
  const accountPad = reqFrom === 'front' ? pwd : '@Admin1234'
  const pwdHashed = await bcrypt.hash(accountPad, 12)
  const now = new Date()

  const result = await Users.insertOne({
    account,
    email,
    role,
    active: true,
    photo: {
      createAt: null,
      fileKey: null,
      url: null
    },
    phoneNumber,
    address,
    pwd: pwdHashed,
    createAt: now,
    pwdChangeAt: now,
    modifiedAt: null,
    disabledAt: null,
    pwdResetToken: null,
    pwdResetExpires: null
  })

  if (!result.acknowledged) {
    return res.status(500).json({
      status: 'failed',
      msg:
        reqFrom === 'front'
          ? '註冊失敗，請稍後再試'
          : '用戶新增失敗，請稍後再試'
    })
  }

  return res.status(201).json({
    status: 'success',
    msg: '註冊成功'
    // data: { insertedId: result.insertedId }
  })
}

/*============= 查詢帳號 =============*/
// 查詢我的帳號(前台, 後台)
exports.myAccount = catchError(async (req, res, next) => {
  await queryAccount(req, res)
})

// 查詢其他 user (後台)
exports.findUserAdmin = catchError(async (req, res, next) => {
  await queryAccount(req, res, 'admin')
})

/**
 * 查詢其他 user (後台)
 * @param {string} req.body.userId
 *
 * 查詢我的帳號(前台, 後台)
 * @param {string} req.body._id
 */
async function queryAccount(req, res, reqFrom = 'user') {
  const reqId = reqFrom === 'user' ? req.user._id : req.body.userId
  const id = validateObjectId(reqId, res)

  const Users = collection('users')
  const user = await Users.findOne(
    { _id: id },
    {
      projection: {
        pwd: 0,
        pwdChangeAt: 0
      }
    }
  )

  if (!user) {
    return res.status(404).json({ status: 'failed', msg: '用戶不存在' })
  }

  const data = renameId('userId', user)
  return res.status(200).json({ status: 'success', msg: '查詢成功', data })
}

// 取得所有帳號(後台)
exports.findAllUsers = catchError(async (req, res, next) => {
  const queryCondition = { ...req.body }

  const users = new SearchDoc('users', queryCondition)

  const dataCount = (await users.countDocuments()) - 1 // 扣除自己的帳號
  const data = await users.filter().sort().limitFields().pagination().exec()
  const totalPages = users.limit > 0 ? Math.ceil(dataCount / users.limit) : 1

  return res.status(200).json({
    status: 'success',
    data,
    dataCount,
    totalPages,
    page: users.currentPage,
    limit: users.limit
  })
})

/*============= 停用,啟用 帳號 =============*/
// 停用,啟用 帳號 (前台)
exports.enableSwitchUser = catchError(async (req, res, next) => {
  await enableSwitchUserHandler(req, res)
})

// 停用,啟用 帳號 (後台)
exports.enableSwitchUserAdmin = catchError(async (req, res, next) => {
  await enableSwitchUserHandler(req, res, 'admin')
})

/**
 * @param {boolean} req.body.enable
 *
 * 後台
 * @param {string} req.body.userId
 *
 * 前台
 * @param {string} req.body._id
 */
async function enableSwitchUserHandler(req, res, reqFrom = 'front') {
  const reqId = reqFrom === 'front' ? req.user._id : req.body.userId
  const id = reqFrom === 'front' ? reqId : validateObjectId(reqId, res)

  const enable = req.body.enable ? req.body.enable : false

  const Users = collection('users')
  const now = new Date()
  const user = await Users.findOneAndUpdate(
    { _id: id },
    { $set: { active: enable, disabledAt: enable ? null : now } },
    {
      projection: {
        pwd: 0,
        createAt: 0,
        pwdChangeAt: 0
      },
      returnDocument: 'after'
    }
  )

  if (!user) {
    return res.status(404).json({ status: 'failed', msg: '用戶不存在' })
  }

  const msg = enable ? '啟用成功' : '已停用'

  const data = renameId('userId', user)
  return res.status(200).json({ status: 'success', msg, data })
}

/*============= user 照片 =============*/
// 上傳,更新照片 (前台)
exports.updateUserPhoto = catchError(async (req, res, next) => {
  await updateUserPhotoObj(req, res)
})

// 上傳,更新照片 (後台)
exports.updateUserPhotoAdmin = catchError(async (req, res, next) => {
  await updateUserPhotoObj(req, res, 'admin')
})

/**
 * @param {Binary} req.file
 *
 * 後台
 * @param {string} req.body.userId
 *
 * 前台
 * @param {string} req.user._id
 */
async function updateUserPhotoObj(req, res, reqFrom = 'front') {
  const reqId = reqFrom === 'front' ? req.user._id : req.body.userId
  const userId = reqFrom === 'front' ? reqId : validateObjectId(reqId, res)

  const { checkFileResult, fileType, file } = checkFileToBeUploaded(req, res)
  if (!checkFileResult) return

  // 確認用戶存在
  const Users = collection('users')
  const user = await Users.findOne({ _id: userId }, { projection: { pwd: 0 } })
  if (!user) {
    return res.status(404).json({ status: 'failed', msg: '用戶不存在' })
  }

  // 透過後端取得 persignedUrl, 然後上傳檔案至 S3
  const { uploadResult, fileKey } = await uploadFileToAWS(res, {
    target: 'userPhoto',
    prefixId: userId,
    fileType,
    file
  })
  if (!uploadResult) return

  // 更新 user 文檔
  const updateContent = {
    photo: {
      createAt: new Date(),
      fileKey,
      url: getAWSImageUrl(fileKey)
    }
  }

  const userUpdated = await Users.findOneAndUpdate(
    { _id: userId },
    { $set: updateContent },
    {
      projection: {
        photo: 1
      },
      returnDocument: 'after'
    }
  )

  if (!userUpdated) {
    return res.status(404).json({ status: 'failed', msg: '照片更新失敗' })
  }

  const data = renameId('userId', userUpdated)

  // 刪除 user 原有的圖片
  const toBeDeleted = user.photo.fileKey

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

// 刪除照片(前台)
exports.deleteUserPhoto = catchError(async (req, res, next) => {
  await deleteUserPhotoObj(req, res)
})

// 刪除照片(後台)
exports.deleteUserPhotoAdmin = catchError(async (req, res, next) => {
  await deleteUserPhotoObj(req, res, 'admin')
})

/**
 * 後台
 * @param {string} req.params.userId
 *
 * 前台
 * @param {string} req.body._id
 */
async function deleteUserPhotoObj(req, res, reqFrom = 'front') {
  const reqId = reqFrom === 'front' ? req.user._id : req.params.userId
  const userId = reqFrom === 'front' ? reqId : validateObjectId(reqId, res)

  const Users = collection('users')
  const user = await Users.findOne(
    { _id: userId },
    { projection: { photo: 1 } }
  )
  if (!user) {
    return res.status(404).json({ status: 'failed', msg: '用戶不存在' })
  }

  // 刪除 user 原有的圖片
  const toBeDeleted = user.photo?.fileKey

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
    photo: {
      createAt: null,
      fileKey: null,
      url: null
    }
  }
  const deletedPhotoResult = await Users.updateOne(
    { _id: userId },
    {
      $set: deleteCondition
    }
  )

  if (deletedPhotoResult.matchedCount === 0) {
    return res.status(404).json({
      status: 'failed',
      msg: '找不到用戶'
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

/*============= 更新 user =============*/
// 更新 user (地址, 電話) - 前台
exports.updateUser = catchError(async (req, res, next) => {
  await updateUserHandler(req, res)
})

// 更新 user (地址, 電話) - 後台
exports.updateUserAdmin = catchError(async (req, res, next) => {
  await updateUserHandler(req, res, 'admin')
})

/**
 * @param {string} req.body.address
 * @param {string} req.body.phoneNumber
 *
 * 後台
 * @param {string} req.body.userId
 *
 * 前台
 * @param {string} req.body._id
 */
async function updateUserHandler(req, res, reqFrom = 'front') {
  const reqId = reqFrom === 'front' ? req.user._id : req.body.userId
  const id = reqFrom === 'front' ? reqId : validateObjectId(reqId, res)

  const parsed = updateUserSchema.safeParse(req.body)

  if (!parsed.success) {
    const errors = parsed.error.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message
    }))

    return res.status(400).json({
      status: 'failed',
      msg: '欄位驗證錯誤',
      errors
    })
  }

  const Users = collection('users')
  const user = await Users.findOne(
    { _id: id },
    { projection: { address: 1, phoneNumber: 1 } }
  )

  if (!user) {
    return res.status(404).json({ status: 'failed', msg: '用戶不存在' })
  }

  const updateData = {
    modifiedAt: new Date()
  }

  const { address, phoneNumber } = req.body

  if ('phoneNumber' in req.body && phoneNumber !== user.phoneNumber) {
    updateData.phoneNumber = phoneNumber
  }

  if ('address' in req.body && address !== user.address) {
    updateData.address = address
  }

  const userUpdated = await Users.findOneAndUpdate(
    { _id: id },
    { $set: updateData },
    {
      projection: {
        pwd: 0,
        createAt: 0,
        pwdChangeAt: 0
      },
      returnDocument: 'after'
    }
  )

  if (!userUpdated) {
    return res.status(404).json({ status: 'failed', msg: '更新失敗' })
  }

  const data = renameId('userId', userUpdated)
  return res.status(200).json({ status: 'success', msg: '更新成功', data })
}

/*============= 登出 登入 =============*/
// 登出(前台)
exports.signout = catchError(async (req, res, next) => {
  logout(req, res)
})

// 登出 (後台)
exports.signoutAdmin = catchError(async (req, res, next) => {
  logout(req, res, 'admin')
})

function logout(req, res, reqFrom = 'front') {
  const jwtName = reqFrom === 'front' ? 'shop-jwt' : 'shop-admin-jwt'
  const jwtOut = reqFrom === 'front' ? 'logout-jwt' : 'logout-admin-jwt'

  const expiresDate = new Date(getTaiwanTimestamp() + 0.5 * 1000)
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https'

  // res.cookie(jwtName, jwtOut, {
  //   expires: expiresDate,
  //   secure: isSecure, // 僅在 HTTPS 下設為 true
  //   sameSite: isSecure ? 'none' : 'lax', // 搭配 sameSite 切換
  //   httpOnly: true,
  //   path: '/'
  // })

  res.clearCookie(jwtName, {
    // expires: expiresDate,
    expires: new Date(0),
    secure: isSecure, // 僅在 HTTPS 下設為 true
    sameSite: isSecure ? 'none' : 'lax', // 搭配 sameSite 切換
    httpOnly: true,
    path: '/'
  })
  res.setHeader('Cache-Control', 'no-store')

  return res.status(200).json({ status: 'success', msg: '已登出' })
}

// 登入(前台)
exports.signIn = catchError(async (req, res, next) => {
  await login(req, res)
})

// 登入(後台)
exports.signInAdmin = catchError(async (req, res, next) => {
  await login(req, res, 'admin')
})

/**
 * @param {string} req.body.account
 * @param {string} req.body.pwd
 */
async function login(req, res, reqFrom = 'front') {
  const parsedData = schemaValidator(res, loginSchema, req.body)
  if (!parsedData) return

  const { account, pwd } = req.body
  const role = reqFrom === 'front' ? 'user' : 'admin'

  if (!account || !pwd) {
    return res.status(400).json({
      status: 'failed',
      msg: '需要帳號,密碼'
    })
  }

  const Users = collection('users')
  const user = await Users.findOne(
    { account, role },
    { projection: { _id: 1, role: 1, pwd: 1, active: 1 } }
  )

  if (!user) {
    return res.status(401).json({ status: 'failed', msg: '帳號或密碼錯誤' })
  }

  const checkPWD = await comparePWD(pwd, user.pwd)
  if (!checkPWD) {
    return res.status(401).json({ status: 'failed', msg: '帳號或密碼錯誤' })
  }

  setTokenInCookie(req, res, user, 200, '登入成功', reqFrom)
}

// 建立 jwt 簽章
function getJWT(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  })
}

// 送出 token 並存於客戶端的 cookie
function setTokenInCookie(req, res, user, statusCode, msg, reqFrom = 'front') {
  const token = getJWT(user._id)

  const expiresDate = new Date(getTaiwanTimestamp() + 48 * 60 * 60 * 1000)

  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https'

  // 防止 CROSS-SITE SCRIPTING (XSS) 攻擊
  const cookieOption = {
    expires: expiresDate,
    secure: isSecure, // 僅在 HTTPS 下設為 true
    sameSite: isSecure ? 'none' : 'lax', // 搭配 sameSite 切換
    httpOnly: true,
    path: '/'
  }

  const jwtName = reqFrom === 'front' ? 'shop-jwt' : 'shop-admin-jwt'
  res.cookie(jwtName, token, cookieOption)

  return res.status(statusCode).json({
    status: 'success',
    msg,
    active: user.active
  })
}

// 檢查密碼是否相同
async function comparePWD(pwdA, pwdB) {
  return bcrypt.compare(pwdA, pwdB)
}

// 是否為登入狀態 (前台)
exports.isLogin = catchError(async (req, res, next) => {
  await loginCheck(req, res)
})

// 是否為登入狀態 (後台)
exports.isLoginAdmin = catchError(async (req, res, next) => {
  await loginCheck(req, res, 'admin')
})

async function loginCheck(req, res, reqFrom = 'front') {
  const jwtName = reqFrom === 'front' ? 'shop-jwt' : 'shop-admin-jwt'
  const jwtCookie = req.cookies[`${jwtName}`]

  if (jwtCookie) {
    const decoded = await promisify(jwt.verify)(
      jwtCookie,
      process.env.JWT_SECRET
    )

    const id = validateObjectId(decoded.id)
    const Users = collection('users')

    const user = await Users.findOne(
      { _id: id },
      {
        projection: {
          account: 1,
          photo: 1,
          active: 1,
          phoneNumber: 1,
          address: 1,
          createAt: 1,
          modifiedAt: 1
        }
      }
    )

    if (!user) {
      logout(req, res, reqFrom)

      return
    }

    return res.status(200).json({
      status: 'success',
      msg: '驗證通過',
      data: user
    })
  }

  return res.status(401).json({
    status: 'failed',
    msg: '用戶未登入'
  })
}

/*============= 密碼 =============*/
// 修改密碼 (前台)
exports.updatePwd = catchError(async (req, res, next) => {
  await changePwd(req, res)
})

// 修改密碼 (後台)
exports.updatePwdAdmin = catchError(async (req, res, next) => {
  await changePwd(req, res, 'admin')
})

/**
 * @param {string} req.body.newPWD
 * @param {string} req.body.pwdCurrent
 */
async function changePwd(req, res, reqFrom = 'front') {
  const Users = collection('users')
  const userId = req.user._id

  const user = await Users.findOne({ _id: userId }, { projection: { pwd: 1 } })

  const parsedData = schemaValidator(res, changePwdlUserSchema, req.body)

  if (!parsedData) return
  const { newPWD } = parsedData

  // 就密碼是否正確
  const checkPwd = await comparePWD(parsedData.pwdCurrent, user.pwd)

  if (!checkPwd) {
    return res.status(401).json({ status: 'failed', msg: '舊密碼錯誤' })
  }

  const pwdHashed = await bcrypt.hash(newPWD, 12)

  const userUpdated = await Users.findOneAndUpdate(
    { _id: userId },
    {
      $set: {
        pwd: pwdHashed,
        pwdChangeAt: new Date(),
        pwdResetToken: null,
        pwdResetExpires: null
      }
    },
    {
      projection: { pwd: 0 },
      returnDocument: 'after'
    }
  )

  setTokenInCookie(req, res, userUpdated, 200, '密碼已修改', reqFrom)
}

// 忘記密碼 - 設定新密碼 (前台)
exports.resetPWD = catchError(async (req, res, next) => {
  await setNewPWDFromUrl(req, res)
})

// 忘記密碼 - 設定新密碼 (後台)
exports.resetPWDAdmin = catchError(async (req, res, next) => {
  await setNewPWDFromUrl(req, res, 'admin')
})

/**
 * @param {string} req.body.newPWD
 * @param {string} req.body.token
 */
async function setNewPWDFromUrl(req, res, reqFrom = 'front') {
  const parsedData = schemaValidator(res, checkPWDFromUrlUserSchema, req.body)
  if (!parsedData) return

  const { token, newPWD } = parsedData
  const role = reqFrom === 'front' ? 'user' : 'admin'

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')
  const now = new Date(getTaiwanTimestamp())

  const pwdHashed = await bcrypt.hash(newPWD, 12)

  const Users = collection('users')

  const userUpdated = await Users.findOneAndUpdate(
    {
      pwdResetToken: hashedToken,
      pwdResetExpires: {
        $gte: now
      },
      role
    },
    {
      $set: {
        pwd: pwdHashed,
        pwdChangeAt: new Date(),
        pwdResetToken: null,
        pwdResetExpires: null
      }
    },
    {
      projection: { pwd: 0 },
      returnDocument: 'after'
    }
  )

  if (!userUpdated) {
    return res.status(400).json({
      status: 'failed',
      msg: '連結已失效或無效，請重新申請密碼重設'
    })
  }

  setTokenInCookie(req, res, userUpdated, 200, '密碼已修改', reqFrom)
}

// 忘記密碼(發送密碼設定連結至用戶信箱) - 前台
exports.forgotPWD = catchError(async (req, res, next) => {
  await sendEmailToResetPWD(req, res)
})

// 忘記密碼(發送密碼設定連結至用戶信箱) - 後台
exports.forgotPWDAdmin = catchError(async (req, res, next) => {
  await sendEmailToResetPWD(req, res, 'admin')
})

/**
 * @param {string} req.body.email
 */
async function sendEmailToResetPWD(req, res, reqFrom = 'front') {
  const parsedData = schemaValidator(res, forgotPWDSchema, req.body)
  if (!parsedData) return

  const role = reqFrom === 'front' ? 'user' : 'admin'

  const { email } = parsedData

  const Users = collection('users')

  const user = await Users.findOne({ email, role })

  if (!user) {
    return res.status(404).json({ status: 'failed', msg: '用戶不存在' })
  }

  const { randomToken, pwdResetToken, pwdResetExpires } =
    createTokenForPwdReset()

  const userUpdated = await Users.findOneAndUpdate(
    { email, role },
    { $set: { pwdResetToken, pwdResetExpires } },
    {
      projection: {
        pwd: 0,
        createAt: 0,
        pwdChangeAt: 0
      },
      returnDocument: 'after'
    }
  )

  if (!userUpdated) {
    return res
      .status(500)
      .json({ status: 'failed', msg: '密碼重設處理失敗，請稍後再試' })
  }

  const subject = '請在 10分鐘內點擊連結, 並完成密碼設定'
  const resetURL =
    reqFrom === 'front'
      ? `${req.get('origin')}/shop/forgot/set_pwd/${randomToken}`
      : `${req.get('origin')}/#/set_pwd/${randomToken}`

  try {
    await new Email(userUpdated, resetURL).send('forgotPassword', subject)

    return res
      .status(200)
      .json({ status: 'success', msg: '已設定連結發送至信箱' })
  } catch (err) {
    await Users.findOneAndUpdate(
      { email, role },
      { $set: { pwdResetToken: null, pwdResetExpires: null } }
    )

    return res
      .status(500)
      .json({ status: 'failed', msg: '送信箱出現錯誤, 請再請求發送一次' })
  }
}

// 忘記密碼, 確認此帳號已存在後送出隨機的 token 給客戶端, 並設定有效時間
function createTokenForPwdReset() {
  const randomToken = crypto.randomBytes(32).toString('hex')
  const pwdResetToken = crypto
    .createHash('sha256')
    .update(randomToken)
    .digest('hex')

  const expiresPeriod = 10 * 60 * 1000
  const pwdResetExpires = new Date(getTaiwanTimestamp() + expiresPeriod)

  return { randomToken, pwdResetToken, pwdResetExpires }
}
