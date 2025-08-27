exports.favoriteJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['userId', 'productId'],
    additionalProperties: false,
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

      addedAt: {
        bsonType: 'date',
        description: '加入時間'
      }
    }
  }
}
