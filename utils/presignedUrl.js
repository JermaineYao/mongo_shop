const { v1: uuidv1 } = require('uuid')
const AppError = require('../utils/appError')
const { setS3 } = require('../utils/s3')

class SetContent {
  /*
    target = 'mainPhoto', 'subPhoto', 'user'

    query = {
      fileType,
      id
    }
    fileTypes = ['jpg', 'png', 'jpeg', 'gif']
    id = userId or productId
  */
  constructor(target, query) {
    this.target = target
    this.query = query
    this.fileKey = ''
    this.url = ''
  }

  async getUrl() {
    const s3 = setS3()
    const Bucket = process.env.s3_BUCKET_NAME

    // 動態組出 S3 路徑
    let prefix
    if (this.target === 'mainPhoto' || this.target === 'subPhoto') {
      prefix = `product/${this.query.id}`
    } else if (this.target === 'user') {
      prefix = `user/${this.query.id}`
    } else {
      throw new AppError('未知的圖片類型', 400)
    }

    const fileKey = `${prefix}/${uuidv1()}.${this.query.fileType}`

    const params = {
      Bucket,
      Key: fileKey,
      ContentType: `image/${this.query.fileType}`
    }

    const url = await s3.getSignedUrlPromise('putObject', params)

    if (!url) throw new AppError('取得簽署 url 失敗', 404)

    this.url = url
    this.fileKey = fileKey

    return this
  }
}

module.exports = SetContent
