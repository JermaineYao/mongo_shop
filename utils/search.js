class SearchDoc {
  constructor(collection, queryString) {}
}

module.exorts = SearchDoc

// class SearchDoc {
//   constructor(collection, queryString) {
//     this.collection = collection
//     this.queryString = queryString
//     this.query = {}
//     this.cursor = null
//   }

//   buildQuery() {
//     const rawQuery = { ...this.queryString }
//     const excludeKeys = ['currentPage', 'sort', 'limit', 'fields']
//     excludeKeys.forEach((key) => delete rawQuery[key])

//     for (const key in rawQuery) {
//       if (rawQuery[key] === '') delete rawQuery[key]
//     }

//     let queryStr = JSON.stringify(rawQuery)
//     queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`)

//     this.query = JSON.parse(queryStr)
//   }

//   async countDocuments() {
//     this.buildQuery()
//     return await this.collection.countDocuments(this.query)
//   }

//   filter() {
//     this.buildQuery()

//     const keyWordsArr = [
//       'name',
//       'account',
//       'userAccount',
//       'contactPhone',
//       'phone'
//     ]
//     const condition = {}

//     for (const key in this.query) {
//       if (keyWordsArr.includes(key)) {
//         condition[key] = { $regex: this.query[key], $options: 'i' }
//       } else {
//         condition[key] = this.query[key]
//       }
//     }

//     this.cursor = this.collection.find(condition)
//     return this
//   }

//   sort() {
//     if (!this.cursor) return this

//     let sortOption = { createAt: -1 } // 預設
//     if (this.queryString.sort) {
//       try {
//         sortOption =
//           typeof this.queryString.sort === 'string'
//             ? JSON.parse(this.queryString.sort)
//             : this.queryString.sort
//       } catch (_) {
//         // 忽略 parse error，保持預設
//       }
//     }

//     this.cursor = this.cursor.sort(sortOption)
//     return this
//   }

//   limitFields() {
//     if (!this.cursor) return this

//     const fields = this.queryString.fields
//     if (fields) {
//       const projection = fields.split(',').reduce((acc, field) => {
//         acc[field.trim()] = 1
//         return acc
//       }, {})
//       this.cursor = this.cursor.project(projection)
//     } else {
//       this.cursor = this.cursor.project({ __v: 0 }) // 預設排除
//     }

//     return this
//   }

//   pagination() {
//     if (!this.cursor) return this

//     const page = parseInt(this.queryString.currentPage) || 1
//     const limit = parseInt(this.queryString.limit) || 10
//     const skip = (page - 1) * limit

//     this.cursor = this.cursor.skip(skip).limit(limit)
//     return this
//   }

//   async exec() {
//     if (!this.cursor) return []
//     return await this.cursor.toArray()
//   }
// }

// module.exports = SearchDoc
