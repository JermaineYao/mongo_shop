const { z, ZodError } = require('zod')
const { isValidObjectId } = require('../../utils/utils')

// 單一商品驗證
const ProductOrderedSchema = z
  .object({
    productId: z
      .string()
      .trim()
      .min(1, 'productId 必填')
      .refine(isValidObjectId, { message: 'productId 格式錯誤' }),

    quantity: z.coerce.number().int().min(1, '數量必須 >= 1')
  })
  .strict() // 禁止多餘欄位

// 建立訂單（從購物車生成 → 同時檢查庫存、扣減庫存）(前台)
exports.createOrderSchema = z
  .object({
    productsOrdered: z.array(ProductOrderedSchema).min(1, '至少要有一項商品'),

    receiver: z.string().trim().min(2, '收件人至少 2 個字'),
    receiverAddress: z.string().trim().min(3, '地址至少 3 個字'),

    receiverPhoneNumber: z
      .string()
      .trim()
      .min(6, '電話至少 6 碼')
      .max(20, '電話最多 20 碼')
      .regex(/^[0-9+\-\s]+$/, '電話格式不正確'),

    note: z.string().trim().optional().nullable()
  })
  .refine(
    // 防「同商品重複提交」：相同 productId 只允許一筆
    ({ productsOrdered }) => {
      const ids = productsOrdered.map((i) => i.productId)
      return new Set(ids).size === ids.length
    },
    { path: ['productsOrdered'], message: '相同商品請合併為一筆' }
  )
  .strict()

// 訂單編號
exports.orderNoSchema = z
  .object({
    orderNo: z
      .string()
      .trim()
      .regex(/^\d{18}$/, '訂單編號必須是 18 位數字')
  })
  .strict()

// 訂單狀態 (前台)
exports.orderStatusSchema = z.object({
  status: z.enum(['cancelled'], {
    required_error: '下個訂單狀態必填'
  })
})

// 訂單狀態 (後台)
exports.orderStatusAdminSchema = z.object({
  status: z.enum(['shipping', 'completed', 'cancelled'], {
    required_error: '下個訂單狀態必填'
  })
})
