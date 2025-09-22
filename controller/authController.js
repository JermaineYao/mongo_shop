const jwt = require('jsonwebtoken')
const { promisify } = require('util')
const { catchError } = require('../utils/catchError')
const AppError = require('../utils/appError')

const { validateObjectId } = require('../utils/utils.js')
const { collection } = require('../utils/db')

// 路由守衛(前台)
exports.routerGuard = catchError(async (req, res, next) => {
  await guard(req, res, next, 'front')
})

// 路由守衛(後台)
exports.routerGuardAdmin = catchError(async (req, res, next) => {
  await guard(req, res, next, 'admin')
})

async function guard(req, res, next, reqFrom = 'front') {
  const jwtName = reqFrom === 'front' ? 'shop-jwt' : 'shop-admin-jwt'
  const userLogined = req.cookies[`${jwtName}`]

  if (!userLogined) {
    const err = new AppError('未登入', 401)

    return next(err)
  }

  let decoded
  try {
    decoded = await promisify(jwt.verify)(userLogined, process.env.JWT_SECRET)
  } catch (err) {
    return next(new AppError('JWT 無效或已過期', 401))
  }

  const id = validateObjectId(decoded.id, res)
  const Users = collection('users')

  const user = await Users.findOne({ _id: id }, { projection: { pwd: 0 } })

  if (!user) {
    const err = new AppError('用戶不存在', 401)

    return next(err)
  }

  // 准許進入 router
  req.user = user

  next()
}

// 從 cookie 回傳 user
exports.decodeCookie = catchError(async (req, res, next) => {
  const userLogined = req.cookies['shop-jwt']

  if (!userLogined) {
    return next()
  }

  let decoded
  try {
    decoded = await promisify(jwt.verify)(userLogined, process.env.JWT_SECRET)
  } catch (err) {
    return next(new AppError('JWT 無效或已過期', 401))
  }

  const id = validateObjectId(decoded.id, res)
  const Users = collection('users')

  const user = await Users.findOne({ _id: id }, { projection: { pwd: 0 } })

  // 准許進入 router
  req.user = user

  next()
})

//  路由使用權限限制, 需帳戶啟用
exports.isUserActive = () => (req, res, next) => {
  if (!req.user.active) {
    return next(new AppError('帳號未啟用', 403))
  }

  next()
}
