const { ObjectId } = require('mongodb')
const { collection } = require('./db')

class SearchDoc {
  constructor(collectionName, queryString) {
    this.collection = collection(collectionName)
    this.queryString = queryString
    this.page = 1
    this.limit = 10
    this.skip = 1
    this.query = {}
    this.cursor = null
  }

  buildQuery() {
    const rawQuery = { ...this.queryString }
    const excludeKeys = ['currentPage', 'sort', 'limit', 'fields']
    excludeKeys.forEach((key) => delete rawQuery[key])

    // 僅移除空字串 / null / undefined，保留 false 與 0
    for (const key in rawQuery) {
      const v = rawQuery[key]

      // 先處理頂層空字串/null/undefined（保留 0/false）
      const isEmptyTopStr = typeof v === 'string' && v.trim() === ''
      if (v == null || isEmptyTopStr) {
        delete rawQuery[key]
        continue
      }

      // 非物件（number/boolean/string 非空）直接跳過
      if (typeof v !== 'object') continue

      // 跳過特殊物件（避免被當作空物件刪掉）
      if (
        v instanceof ObjectId ||
        v instanceof Date ||
        v instanceof RegExp
        // 需要就再加上 BSON/Buffer/Decimal128 等型別
      ) {
        continue
      }

      // 陣列：做元素過濾
      if (Array.isArray(v)) {
        const filtered = v.filter((el) => {
          const isEmptyStr = typeof el === 'string' && el.trim() === ''
          return !(el == null || isEmptyStr)
        })
        if (filtered.length === 0) delete rawQuery[key]
        else rawQuery[key] = filtered
        continue
      }

      // 只清理「純物件」的子鍵
      if (Object.prototype.toString.call(v) === '[object Object]') {
        for (const subKey in v) {
          const subV = v[subKey]
          const isEmptySubStr = typeof subV === 'string' && subV.trim() === ''
          if (subV == null || isEmptySubStr) {
            delete v[subKey]
          }
        }
        if (Object.keys(v).length === 0) delete rawQuery[key]
        continue
      }

      // 其他非純物件（例如 Map/Set/自訂類別）一律保留
    }

    // 把 'true'/'false' 字串轉成布林
    if (typeof rawQuery.active === 'string') {
      if (rawQuery.active.toLowerCase() === 'true') rawQuery.active = true
      else if (rawQuery.active.toLowerCase() === 'false')
        rawQuery.active = false
    }

    if (typeof rawQuery.enable === 'string') {
      if (rawQuery.enable.toLowerCase() === 'true') rawQuery.enable = true
      else if (rawQuery.enable.toLowerCase() === 'false')
        rawQuery.enable = false
    }

    // 先保留 ObjectId 類型的欄位，避免 stringify → string
    const preserveObjectIds = {}
    const objectIdKeys = ['_id', 'userId', 'productId', 'orderId']
    for (const k of objectIdKeys) {
      if (rawQuery[k] && rawQuery[k] instanceof ObjectId) {
        preserveObjectIds[k] = rawQuery[k]
      }
    }

    let queryStr = JSON.stringify(rawQuery)
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (m) => `$${m}`)
    this.query = JSON.parse(queryStr)

    // 還原 ObjectId
    Object.assign(this.query, preserveObjectIds)

    // 需要模糊比對
    const keywordFieldsOfUsers = ['account', 'email', 'phoneNumber', 'address']
    const keywordFieldsOfProducts = ['productNameMain', 'productNameSub']
    const keywordFieldsOfOrders = [
      'orderNo',
      'receiver',
      'receiverAddress',
      'receiverPhoneNumber'
    ]

    const keywordFields = [
      ...keywordFieldsOfUsers,
      ...keywordFieldsOfProducts,
      ...keywordFieldsOfOrders
    ]

    for (const field of keywordFields) {
      const val = this.query[field]

      if (val != null && val !== '') {
        this.query[field] = {
          $regex: val.trim(), // 模糊比對
          $options: 'i' // 忽略大小寫
        }
      } else {
        delete this.query[field]
      }
    }
  }

  async countDocuments() {
    this.buildQuery()
    return await this.collection.countDocuments(this.query)
  }

  filter() {
    this.buildQuery()

    this.cursor = this.collection.find(this.query)
    return this
  }

  // 排序
  sort() {
    if (!this.cursor) return this

    let sortOption = { createAt: -1 }
    if (this.queryString.sort) {
      try {
        sortOption =
          typeof this.queryString.sort === 'string'
            ? JSON.parse(this.queryString.sort)
            : this.queryString.sort
      } catch (_) {}
    }

    this.cursor = this.cursor.sort(sortOption)
    return this
  }

  // 回傳那些字段
  limitFields() {
    if (!this.cursor) return this

    // fields 是陣列或字串
    const fields = this.queryString.fields

    if (fields != null && fields !== '') {
      let fieldArr = []

      if (Array.isArray(fields)) {
        fieldArr = fields
      } else if (typeof fields === 'string') {
        fieldArr = fields.split(',')
      } else {
        // 不是合法的欄位輸入，略過
        fieldArr = []
      }

      // 過濾掉非字串或空值的欄位
      fieldArr = fieldArr
        .filter((f) => typeof f === 'string' && f.trim() !== '')
        .map((f) => f.trim())

      if (fieldArr.length > 0) {
        const projection = fieldArr.reduce((acc, field) => {
          acc[field] = 1
          return acc
        }, {})
        this.cursor = this.cursor.project(projection)
      }
    }
    return this
  }

  pagination() {
    if (!this.cursor) return this

    this.page = parseInt(this.queryString.currentPage) || 1 // 目前頁數
    this.limit = parseInt(this.queryString.limit) || 10 // 每頁多少筆
    this.skip = (this.page - 1) * this.limit // 從第幾筆開始取

    this.cursor = this.cursor.skip(this.skip).limit(this.limit)
    return this
  }

  async exec() {
    if (!this.cursor) return []
    return await this.cursor.toArray()
  }
}

module.exports = SearchDoc
