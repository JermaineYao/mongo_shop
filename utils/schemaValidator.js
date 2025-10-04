exports.schemaValidator = (res, schema, content) => {
  const parsed = schema.safeParse(content)

  if (!parsed.success) {
    const errors = parsed.error.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message
    }))

    res.status(400).json({
      status: 'failed',
      msg: '欄位驗證錯誤',
      errors
    })

    return null
  }

  return parsed.data
}
