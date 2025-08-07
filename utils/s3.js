const AWS = require('aws-sdk')

// 建立 s3 物件
exports.setS3 = () => {
  const s3 = new AWS.S3({
    credentials: {
      accessKeyId: process.env.S3_SECRET_KEY_ID,
      secretAccessKey: process.env.S3_SECRET
    },
    region: process.env.S3_REGION
  })

  return s3
}
