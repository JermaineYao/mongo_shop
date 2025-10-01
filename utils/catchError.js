exports.catchError = (fn) => {
  return (req, res, next) => {
    Promise.resolve()
      .then(() => fn(req, res, next))
      .catch((err) => {
        if (res.headersSent) {
          console.warn('⚠️ headers 已送出仍捕捉到錯誤：', err?.message)

          return
        }
        next(err)
      })
  }
}
