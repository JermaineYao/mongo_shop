exports.cartJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['userId', 'productId', 'quantity'],
    properties: {
      _id: { bsonType: 'objectId' },

      userId: {
        bsonType: 'objectId',
        description: '用戶 ID，必填'
      },

      productId: {
        bsonType: 'objectId',
        description: '產品 ID，必填'
      },

      quantity: {
        bsonType: 'int',
        minimum: 1,
        description: '必填，訂購數量 >= 1 的整數'
      },

      addedAt: {
        bsonType: 'date',
        description: '加入時間'
      }
    }
  }
}
