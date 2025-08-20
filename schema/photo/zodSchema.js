// const { z, ZodError } = require('zod')

// exports.checkUploadPhotoSchema = z.object({
//   target: z.enum(['mainPhoto', 'subPhoto', 'userPhoto'], {
//     errorMap: () => ({
//       message: 'target 必須是 mainPhoto, subPhoto 或 userPhoto'
//     })
//   })
// })

// exports.checkFileToBeUploaded = (req, res) => {
//   if (!req.files || !req.files[0]) {
//     res.status(400).json({
//       status: 'failed',
//       msg: '請提供圖片檔案'
//     })

//     return { checkFileResult: false, fileType: null, file: null }
//   }

//   const file = req.files?.[0]
//   const fileType = file.mimetype.split('/')[1] // e.g. 'image/jpeg'

//   const allowedMimes = ['jpeg', 'png', 'gif', 'jpg']

//   if (!allowedMimes.includes(fileType)) {
//     res.status(400).json({
//       status: 'failed',
//       msg: '不支援的檔案格式'
//     })

//     return { checkFileResult: false, fileType: null, file: null }
//   }

//   return { checkFileResult: true, fileType, file }
// }
