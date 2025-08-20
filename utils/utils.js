const { ObjectId } = require('mongodb')

exports.formatDateTimeTW = (date = new Date()) => {
  return date
    .toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    .replace(/\//g, '-')
    .replace(',', '')
}

exports.getTaiwanTime = () => {
  // const now = new Date()
  // const taiwanStr = now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' })

  // return new Date(taiwanStr)

  const now = new Date()
  return new Date(now.getTime() + 8 * 60 * 60 * 1000)
}

exports.getTaiwanTimestamp = (date = new Date()) => {
  // 強制轉為台灣時區的時間後再取 timestamp
  const taiwanTime = new Date(
    date.toLocaleString('en-US', { timeZone: 'Asia/Taipei' })
  )

  return taiwanTime.getTime() // 以毫秒為單位
}

exports.validateObjectId = (objId, res) => {
  const id = `${objId}`
  if (!ObjectId.isValid(id)) {
    res.status(400).json({ status: 'failed', msg: '無效的 ID' })

    return null
  }

  return new ObjectId(id)
}

exports.renameId = (idField, data) => {
  if (!data) return null

  if (Array.isArray(data)) {
    return data.map((doc) => renameId(idField, doc))
  }

  const { _id, ...rest } = data
  return {
    ...rest,
    [idField]: _id
  }
}

exports.checkFileToBeUploaded = (req, res) => {
  if (!req.files || !req.files[0]) {
    res.status(400).json({
      status: 'failed',
      msg: '請提供圖片檔案'
    })

    return { checkFileResult: false, fileType: null, file: null }
  }

  const file = req.files?.[0]
  const fileType = file.mimetype.split('/')[1] // e.g. 'image/jpeg'

  const allowedMimes = ['jpeg', 'png', 'gif', 'jpg']

  if (!allowedMimes.includes(fileType)) {
    res.status(400).json({
      status: 'failed',
      msg: '不支援的檔案格式'
    })

    return { checkFileResult: false, fileType: null, file: null }
  }

  return { checkFileResult: true, fileType, file }
}
