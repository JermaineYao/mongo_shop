// const { MongoClient } = require('mongodb')

// // 環境變數
// const dotenv = require('dotenv')

// dotenv.config({
//   path: './.env',
//   override: true,
//   quiet: true
// })

// const DB = process.env.DB

// const client = new MongoClient(DB)
// const db = client.db('shop')

// function collection(collectionName) {
//   return db.collection(collectionName)
// }

// module.exports = {
//   client,
//   db,
//   DB,
//   collection
// }

const { MongoClient } = require('mongodb')
const dotenv = require('dotenv')

dotenv.config({
  path: './.env',
  override: true,
  quiet: true
})

const DBurl = process.env.DB
const client = new MongoClient(DBurl)

async function connectDB() {
  try {
    await client.connect()
    console.log('✅ MongoDB 已連線')
  } catch (err) {
    console.error('❌ 連線 MongoDB 失敗:', err.message)
    process.exit(1)
  }
}

// 取得 db
function DB() {
  return client.db('shop')
}

// 取得集合
function collection(name) {
  return DB().collection(name)
}

// 集合是否已建立
async function collectionExists(collectionName) {
  const collections = await DB()
    .listCollections({}, { nameOnly: true })
    .toArray()

  const exists = collections.some((col) => col.name === collectionName)

  return exists
}

module.exports = {
  client,
  connectDB,
  collection,
  collectionExists,
  DB
}
