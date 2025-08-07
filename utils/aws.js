const axios = require('axios')

const { setS3 } = require('../utils/s3')
const SetContent = require('../utils/presignedUrl')

const s3 = setS3()

exports.uploadFileToAWS = async (res, uploadContent) => {
  /*
    target : ['mainPhoto', 'subPhoto', 'user']
    prefixId : userId or productId
    fileTypes : ['jpg', 'png', 'jpeg', 'gif']
  */
  const { target, prefixId, fileType, file } = uploadContent

  // 1. 產生 presigned URL
  let presigned
  try {
    presigned = await new SetContent(target, prefixId, fileType).getUrl()
  } catch (err) {
    console.error('產生 URL 失敗', err)
    res.status(500).json({ error: '無法取得上傳 URL' })

    return { uploadResult: false, fileKey: null }
  }

  // 2. PUT 上傳檔案到 S3
  try {
    console.log('presigned', presigned)
    await axios.put(presigned.url, file.buffer, {
      headers: { 'Content-Type': file.mimetype }
    })
  } catch (err) {
    console.error('上傳到 S3 失敗:', err.response?.data || err.message)
    res.status(500).json({ error: '檔案上傳失敗' })

    return { uploadResult: false, fileKey: null }
  }

  // 3. 回傳結果（含 fileKey）
  return { uploadResult: true, fileKey: presigned.fileKey }
}

exports.deleteFileFromAWS = async (fileKey) => {
  const toBeDeleted = {
    Bucket: process.env.s3_BUCKET_NAME,
    Key: fileKey
  }

  try {
    await s3.deleteObject(toBeDeleted).promise()

    return { deleteResult: true, errMsg: null }
  } catch (err) {
    return { deleteResult: false, errMsg: err.message }
  }
}

exports.getAWSImageUrl = (fileKey) => {
  return `https://${process.env.s3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/${fileKey}`
}
