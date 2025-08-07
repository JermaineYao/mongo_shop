// class AppError extends Error {
//   constructor(message, statusCode) {
//     console.log('statusCode', statusCode)

//     super(message)
//     this.statusCode = statusCode
//     this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error'
//     this.isOperational = true

//     Error.captureStackTrace(this, this.constructor)
//   }
// }

class AppError extends Error {
  constructor(message, statusCode) {
    super(message)

    this.statusCode = statusCode
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error'
    this.isOperational = true

    console.log('⚠️ AppError 建立成功：', { message, statusCode }) // ← 強制印出
    Error.captureStackTrace(this, this.constructor)
  }
}

module.exports = AppError
