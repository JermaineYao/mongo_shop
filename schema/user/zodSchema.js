const { z, ZodError } = require('zod')

// 註冊
exports.createUserSchema = z
  .object({
    account: z
      .string()
      .min(1, '帳號必填')
      .regex(
        /^[a-zA-Z][a-zA-Z0-9]*$/,
        '帳號只能是英文字母開頭，後面可接英文或數字'
      ),

    email: z.string().trim().toLowerCase().email('信箱格式錯誤'),

    pwd: z
      .string()
      .trim()
      .min(8)
      .regex(
        /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|\\,.\/<>?;:'"~`])/,
        '至少 8位元、至少包含一個大寫、小寫英文字母、數字、特殊字元'
      ),

    address: z
      .string()
      .transform((val) => val.trim())
      .optional()
      .nullable(),

    phoneNumber: z
      .union([z.string(), z.undefined(), z.null()])
      .transform((val) =>
        typeof val === 'string' && val.trim() === ''
          ? null
          : (val?.trim() ?? null)
      )
      .refine((val) => val === null || /^09\d{2}-\d{3}-\d{3}$/.test(val), {
        message: '手機格式錯誤'
      })
  })
  .strict() // 禁止多餘欄位

// 檢查 帳號 或 EMAIL 是否已被使用
exports.checkUserSchema = z
  .object({
    account: z.string().optional().nullable(),

    email: z
      .string()
      .optional()
      .nullable()
      .refine(
        (val) => val === undefined || val === null || typeof val === 'string',
        {
          message: 'Email 格式錯誤'
        }
      )
  })
  .refine(
    (data) => {
      return (
        !!(data.account && data.account.trim()) ||
        !!(data.email && data.email.trim())
      )
    },
    {
      message: '帳號或 Email 至少需提供一項',
      path: ['account']
    }
  )
  .strict() // 禁止多餘欄位

// 更新 user (地址, 電話)
exports.updateUserSchema = z
  .object({
    address: z
      .string()
      .transform((val) => val.trim())
      .optional()
      .nullable(),

    phoneNumber: z
      .string()
      .transform((val) => (val.trim() === '' ? null : val.trim()))
      .nullable()
      .optional()
      .refine((val) => val === null || /^09\d{2}-\d{3}-\d{3}$/.test(val), {
        message: '手機格式錯誤'
      })
  })
  .strict() // 禁止多餘欄位

// 忘記密碼 - 設定新密碼
exports.checkPWDFromUrlUserSchema = z
  .object({
    token: z.string().trim(),

    newPWD: z
      .string()
      .trim()
      .min(8)
      .regex(
        /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|\\,.\/<>?;:'"~`])/,
        '至少 8位元、至少包含一個大寫、小寫英文字母、數字、特殊字元'
      )
  })
  .strict() // 禁止多餘欄位

// 上傳照片
exports.userPhotoSchema = z.object({
  fileKey: z.string().trim().min(1, 'fileKey 為必填')
})
