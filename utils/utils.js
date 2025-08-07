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
  const now = new Date()
  const taiwanStr = now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' })

  return new Date(taiwanStr)
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
