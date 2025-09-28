const { z, ZodError } = require('zod')
const { isValidObjectId } = require('../../utils/utils')

exports.createCartSchema = z
  .object({
    // userId: z
    //   .string()
    //   .refine(isValidObjectId, { message: 'userId 格式錯誤' })
    //   .optional(),

    productId: z
      .string()
      .refine(isValidObjectId, { message: 'productId 格式錯誤' }),

    quantity: z.coerce
      .number({ invalid_type_error: '訂購數量必須是數字' })
      .int('訂購數量必須是整數')
      .min(1, '訂購數量不可小於 1')
  })
  .strict() // 禁止多餘欄位
