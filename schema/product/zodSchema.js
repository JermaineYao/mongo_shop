const { z, ZodError } = require('zod')

// 新增產品
exports.createProducSchema = z
  .object({
    nameMain: z.string().trim().min(1, '產品主名稱必填'),

    nameSub: z.string().trim().min(1, '產品副名稱必填'),

    price: z
      .string()
      .trim()
      .regex(/^\d+(\.\d+)?$/, '價格必須是數字')
      .transform((val) => Number(val))
      .refine((val) => val > 0, '價格必須大於 0')
  })
  .strict() // 不允許主圖物件內多餘欄位

// 檢查 產品名稱 是否已被使用
exports.checkProductSchema = z
  .object({
    nameMain: z.string().trim().optional().nullable(),

    nameSub: z.string().trim().optional().nullable()
  })
  .refine(
    (data) => {
      return (
        !!(data.nameMain && data.nameMain.trim()) ||
        !!(data.nameSub && data.nameSub.trim())
      )
    },
    {
      message: '產品主名稱或 產品副名稱 至少需提供一項',
      path: ['nameMain']
    }
  )
  .strict() // 禁止多餘欄位

// 修改商品內容 (圖片資訊除外)
exports.updateProductSchema = z
  .object({
    productId: z.string().min(1, '缺少商品 ID'),

    category: z
      .enum(['0', '1', '2'], { required_error: '商品分類必填' })
      .optional(),

    price: z.coerce
      .number({ invalid_type_error: '價格必須是數字' })
      .int('價格必須是整數')
      .min(0, '價格不可小於 0')
      .optional(),

    size: z.string().optional(),

    description: z.array(z.string()).optional(),

    inStock: z.coerce
      .number({ invalid_type_error: '庫存必須是數字' })
      .int('庫存必須是整數')
      .min(0, '庫存不可小於 0')
      .optional(),

    enable: z.coerce
      .boolean({ invalid_type_error: 'enable 必須是布林值' })
      .optional()

    // mainPhoto: mainPhotoPatchSchema.optional(),

    // createAt: z.union([z.string(), z.date()]).optional()
  })
  .strict()
  .refine(
    (data) => {
      // 至少要帶一個更新欄位（除了 productId 以外）
      const keys = Object.keys(data).filter((k) => k !== 'productId')
      return keys.length > 0
    },
    { message: '提供的內容與原本沒有差異' }
  )

// 修改圖片資訊除
// exports.subPhotoSchema = z
//   .object({
//     subPhotoId: z.string().min(1, '缺少次要商品圖片 ID'),
//     createAt: z.union([z.string(), z.date()]).optional(),
//     fileKey: z.string().nullable().optional(),
//     url: z.string().nullable().optional(),
//     description: z.string().trim().nullable().optional()
//   })
//   .strict() // 不允許主圖物件內多餘欄位
