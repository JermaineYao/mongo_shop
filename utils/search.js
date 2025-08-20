const { collection } = require('./db')

class SearchDoc {
  constructor(collectionName, queryString) {
    this.collection = collection(collectionName)
    this.queryString = queryString
    this.query = {}
    this.cursor = null
  }

  buildQuery() {
    const rawQuery = { ...this.queryString }
    const excludeKeys = ['currentPage', 'sort', 'limit', 'fields']
    excludeKeys.forEach((key) => delete rawQuery[key])

    for (const key in rawQuery) {
      if (rawQuery[key] === '') delete rawQuery[key]
    }

    let queryStr = JSON.stringify(rawQuery)
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`)

    this.query = JSON.parse(queryStr)

    // 需要模糊比對
    const keywordFieldsOfUsers = ['account', 'email', 'phoneNumber', 'address']
    const keywordFieldsOfProducts = ['productNameMain', 'productNameSub']

    const keywordFields = [...keywordFieldsOfUsers, ...keywordFieldsOfProducts]
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

    const page = parseInt(this.queryString.currentPage) || 1 // 目前頁數
    const limit = parseInt(this.queryString.limit) || 10 // 每頁多少筆
    const skip = (page - 1) * limit // 從第幾筆開始取

    this.cursor = this.cursor.skip(skip).limit(limit)
    return this
  }

  async exec() {
    if (!this.cursor) return []
    return await this.cursor.toArray()
  }
}

module.exports = SearchDoc
