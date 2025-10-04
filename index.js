// const { MongoClient } = require('mongodb')
const { connectDB } = require('./utils/db')

/*---------------------- 引入 server ----------------------*/
const app = require('./app')

// 環境變數
const dotenv = require('dotenv')

dotenv.config({
  path: './.env',
  override: true,
  quiet: true
})

/* ---------- Uncaught Exptions (同步) ----------- */
process.on('uncaughtException', (err) => {
  console.log(err.name, err.message)
  console.log('uncaught Exception')
  // 只有事件請求發生 才會 console.log(x)
  // console.log(x)
  process.exit(1)
})

/*---------------------- 連結資料庫 ----------------------*/
// async function connectDB() {
//   try {
//     await client.connect()
//     client.db('shop')
//     console.log('✅ 成功連上 MongoDB')
//   } catch (err) {
//     console.error('❌ MongoDB 連線失敗:', err)
//     process.exit(1)
//   }
// }

connectDB()

// const server = app.listen(1000, '127.0.0.1', () => {
//   console.log('server is on')
// })

const server = app.listen(() => {
  console.log('server is on')
})

/*---------- 全域處理 非 express 錯誤 unhandled Rejection (例如連線驗證失敗) ----------*/
process.on('unhandledRejection', (err) => {
  console.log(err.name, err.message)
  console.log('UNHANDLER REJECTION!')
  server.close(() => {
    process.exit(1)
  })
})

process.on('SIGTERM', () => {
  console.log(' 👋 SIGTERM RECEIVED, Shutting down greacefully')
  server.close(() => {
    console.log('🎇 Process Terminated!')
  })
})
