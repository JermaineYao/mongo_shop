const multer = require('multer')
const axios = require('axios')

const { catchError } = require('../utils/catchError')
const SetContent = require('../utils/presignedUrl')

// 前台取得 presigned url, 再透過後端上傳檔案給 S3
const upload = multer().any()

// 取得 presigned url
exports.getAWSpreSignedUrl = catchError(async (req, res, next) => {
  const { target, id, fileType } = req.body

  const result = await new SetContent(target, { id, fileType }).getUrl()

  res.status(201).json({
    status: 'success',
    preSignedUrl: result.url,
    fileKey: result.fileKey
  })
})

exports.sendFileToS3 = catchError(async (req, res, next) => {
  await upload(req, res, async (err) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ error: 'Failed to parse FormData.' })
    }

    // 假設 req.files 是上傳的圖片檔案
    const file = req.files[0]
    const preSignedUrl = req.body.url

    try {
      // 上傳圖片到 S3
      await uploadToS3(file, preSignedUrl)

      res.status(201).json({
        status: 'success'
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to upload file to S3.' })
    }
  })
})

// 上傳圖片到 S3
async function uploadToS3(file, preSignedUrl) {
  const options = {
    headers: {
      'Content-Type': file.mimetype
    }
  }

  try {
    await axios.put(preSignedUrl, file.buffer, options)
  } catch (err) {
    throw new Error('Failed to upload file to S3.')
  }
}
