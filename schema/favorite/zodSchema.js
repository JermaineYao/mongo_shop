const { z, ZodError } = require('zod')
const { isValidObjectId } = require('../../utils/utils')

exports.createFavoriteSchema = z
  .object({
    userId: z
      .string()
      .refine(isValidObjectId, { message: 'userId 格式錯誤' })
      .optional(),

    productId: z
      .string()
      .refine(isValidObjectId, { message: 'productId 格式錯誤' })
  })
  .strict() // 禁止多餘欄位
