const { v1: uuidv1 } = require('uuid')
const AppError = require('../utils/appError')
const { setS3 } = require('../utils/s3')

class SetContent {
  /*
    target = 'mainPhoto', 'subPhoto', 'userPhoto'

    query = {
      fileType,
      id
    }
    fileTypes = ['jpg', 'png', 'jpeg', 'gif']
    prefixId = userId or productId
  */
  constructor(target, prefixId, fileType) {
    this.target = target
    this.fileType = fileType
    this.prefixId = prefixId
    this.fileKey = ''
    this.url = ''
  }

  async getUrl() {
    const s3 = setS3()
    const Bucket = process.env.s3_BUCKET_NAME

    // 動態組出 S3 路徑
    let prefix
    if (this.target === 'mainPhoto' || this.target === 'subPhoto') {
      prefix = `product/${this.prefixId}`
    } else if (this.target === 'userPhoto') {
      prefix = `user/${this.prefixId}`
    } else {
      throw new AppError('未知的圖片類型', 400)
    }

    const fileKey = `${prefix}/${uuidv1()}.${this.fileType}`

    const params = {
      Bucket,
      Key: fileKey,
      ContentType: `image/${this.fileType}`
    }

    const url = await s3.getSignedUrlPromise('putObject', params)

    if (!url) throw new AppError('取得簽署 url 失敗', 404)

    this.url = url
    this.fileKey = fileKey

    return this
  }
}

module.exports = SetContent
