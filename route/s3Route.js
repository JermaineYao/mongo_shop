const express = require('express')

const aws = require('../controller/awsController')
const {
  routerGuard,
  routerGuardAdmin,
  restrictTo
} = require('../controller/authController')

const router = express.Router()

// 前台
router.post('/get_presigned_url', routerGuard, aws.getAWSpreSignedUrl)
router.post('/send_to_aws', aws.sendFileToS3)

// 後台
router.post(
  '/get_presigned_url_admin',
  routerGuardAdmin,
  restrictTo(['admin']),
  aws.getAWSpreSignedUrl
)

module.exports = router
