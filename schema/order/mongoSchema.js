exports.orderJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'orderNo',
      'account',
      'email',
      'userId',
      'productsOrdered',
      'totalAmount',
      'orderStatus',
      'receiver',
      'receiverAddress',
      'receiverPhoneNumber',
      'createdAt',
      'note'
    ],
    properties: {
      _id: { bsonType: 'objectId' },
      orderNo: { bsonType: 'string' },
      account: { bsonType: 'string' },
      email: {
        bsonType: 'string',
        pattern: '^.+@.+\\..+$',
        description: '必填，且應為合法 email 格式'
      },
      userId: { bsonType: 'objectId' },
      productsOrdered: {
        bsonType: 'array',
        minItems: 1,
        items: {
          bsonType: 'object',
          required: [
            'productId',
            'productNameMain',
            'productNameSub',
            'category',
            'price',
            'quantity',
            'subtotal'
          ],
          properties: {
            productId: { bsonType: 'objectId' },
            productNameMain: { bsonType: 'string' },
            productNameSub: { bsonType: 'string' },
            category: {
              bsonType: 'string',
              enum: ['0', '1', '2'],
              description: '必填，商品分類  0 碗, 1 瓶子, 2 杯子'
            },
            price: { bsonType: ['int', 'long', 'double'], minimum: 0 },
            mainPhoto: {
              bsonType: 'object',
              required: ['url'],
              additionalProperties: false,
              properties: {
                url: {
                  bsonType: 'string',
                  description: 'S3 檔案 URL'
                }
              }
            },
            quantity: { bsonType: 'int', minimum: 1 },
            subtotal: { bsonType: ['int', 'long', 'double'], minimum: 0 }
          },
          additionalProperties: false
        }
      },
      totalAmount: { bsonType: ['int', 'long', 'double'], minimum: 0 },
      orderStatus: { enum: ['pending', 'shipping', 'completed', 'cancelled'] },
      receiver: { bsonType: 'string', minLength: 2 },
      receiverAddress: { bsonType: 'string', minLength: 3 },
      receiverPhoneNumber: {
        bsonType: 'string',
        minLength: 6,
        maxLength: 20,
        pattern: '^[0-9+\\-\\s]+$'
      },
      note: {
        bsonType: ['string', 'null'],
        description: '訂單備註'
      },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    },
    additionalProperties: false
  }
}
