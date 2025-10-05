/*---------------------- 執行 express ----------------------*/
const express = require('express')
const app = express() // 執行同時建立 server
const path = require('path')

/*---------------------- 跨域cors ----------------------*/
const cors = require('cors')

app.use(
  cors({
    credentials: true,
    origin: [process.env.URLP, process.env.URLF]
  })
)

// /* ----- 設定 pug template -----*/
app.set('view engine', 'pug')
app.set('views', [
  path.join(__dirname, 'views'),
  path.join(__dirname, 'views/email/')
])
app.use(express.static(path.join(__dirname, 'public')))

// /* ----- 設定 sass/scss -----*/
app.use(express.static(path.join(__dirname, 'public/style')))

/*---------------------- helmet ----------------------*/
const helmet = require('helmet')

app.use(helmet())

/*---------------------- rate-limit ----------------------*/
const rateLimit = require('express-rate-limit')

const limiter = rateLimit({
  max: 2000, // 最多可以接受 100個請求
  windowMs: 60 * 60 * 1000, // 在一小之內
  message: 'Too many requests from this IP, please try again in an hour!'
})

app.use('/api', limiter)

/*------- 防止 MongoDB 被注入攻擊 -------*/
const mongoSanitize = require('express-mongo-sanitize')
app.use(mongoSanitize())

/*------- 防止跨網站指令碼攻擊（Cross-Site Scripting, XSS） -------*/
const xss = require('xss-clean')
app.use(xss())

/*---------------------- morgan ----------------------*/
const morgan = require('morgan')

if (process.env.NODE_ENV === 'dev') {
  app.use(morgan('dev'))
}

/*---------------------- app.use ----------------------*/
app.use(express.json())
app.use((req, res, next) => {
  const now = new Date()
  const timezoneOffset = 480 // 台灣與 UTC 的差距為 480 分鐘
  const taiwanTime = new Date(now.getTime() + timezoneOffset * 60 * 1000) // 台灣時間
  req.requestTime = taiwanTime

  next()
})

// 解析 URL-encoded 格式的請求主體（即 Content-Type 為 application/x-www-form-urlencoded 的請求）
app.use(express.urlencoded({ extended: true }))

// cookie
const cookieParser = require('cookie-parser')
app.use(cookieParser())

// 進行壓縮
const compression = require('compression')
app.use(compression())

/*---------------------- router ----------------------*/
const apiVersion = '/api/v1'
// 用戶
const userUrl = `${apiVersion}/user`
const userRouter = require('./route/userRoute')
app.use(userUrl, userRouter)

// 商品
const procudtUrl = `${apiVersion}/product`
const productRouter = require('./route/productRoute')
app.use(procudtUrl, productRouter)

// 我的最愛
const favoriteUrl = `${apiVersion}/favorite`
const favoriateRouter = require('./route/favoriateRoute')
app.use(favoriteUrl, favoriateRouter)

// 購物車
const cartUrl = `${apiVersion}/cart`
const cartRouter = require('./route/cartRoute')
app.use(cartUrl, cartRouter)

// 訂單
const orderUrl = `${apiVersion}/order`
const orderRouter = require('./route/orderRoute')
app.use(orderUrl, orderRouter)

// /* --------------- 處理不存在的網址請求 ---------------*/
const AppError = require('./utils/appError')

app.all('*', (req, res, next) => {
  next(new AppError('不存在的請求', 404))
})

app.use((err, req, res, next) => {
  // console.error('錯誤訊息：', err)

  // const statusCode = err.statusCode || 500
  // const status = err.status || 'error'

  // res.status(statusCode).json({
  //   status,
  //   message: err.message || '伺服器發生錯誤'
  // })

  console.error('[ERR]', req.method, req.originalUrl)
  console.error(err && err.stack) // ✅ 看堆疊，通常可直接定位檔案與行數
  if (res.headersSent) return next(err)
  const code = err.statusCode || 500
  return res
    .status(code)
    .json({ status: 'failed', message: err.message || '伺服器發生錯誤' })
})
/*---------------------- 導出 app ----------------------*/
module.exports = app
