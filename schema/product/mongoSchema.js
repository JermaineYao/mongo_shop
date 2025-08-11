exports.productJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'name',
      'category',
      'price',
      'inStock',
      'enable',
      'mainPhoto',
      'createAt'
    ],
    additionalProperties: false,
    properties: {
      name: {
        bsonType: 'string',
        description: '必填，商品名稱'
      },
      category: {
        bsonType: 'string',
        enum: ['0', '1', '2'],
        description: '必填，商品分類  0 碗, 1 瓶子, 2 杯子'
      },
      price: {
        bsonType: 'int',
        minimum: 0,
        description: '必填，價格 >= 0'
      },
      size: {
        bsonType: 'string',
        description: '可選，尺寸字串'
      },
      description: {
        bsonType: 'array',
        items: {
          bsonType: 'string'
        },
        description: '可選，描述陣列'
      },
      inStock: {
        bsonType: 'int',
        minimum: 0,
        description: '必填，庫存 >= 0 的整數'
      },
      enable: {
        bsonType: 'bool',
        description: '必填，true 啟用, false 停用'
      },
      mainPhoto: {
        bsonType: 'object',
        required: ['createAt', 'fileKey', 'url', 'description'],
        additionalProperties: false,
        properties: {
          createAt: {
            bsonType: ['string', 'date'],
            description: '主圖建立時間'
          },
          fileKey: {
            bsonType: ['string', 'null'],
            description: 'S3 檔案 key，可為 null'
          },
          url: {
            bsonType: ['string', 'null'],
            description: 'S3 檔案 URL，可為 null'
          },
          description: {
            bsonType: 'string',
            description: '圖片描述字串（可空字串）'
          }
        }
      },
      subPhotos: {
        bsonType: 'array',
        description: '次要圖片陣列',
        items: {
          bsonType: 'object',
          required: ['createAt', 'fileKey', 'url', 'description'],
          additionalProperties: false,
          properties: {
            _id: { bsonType: 'objectId' },
            createAt: { bsonType: ['date', 'string'] },
            fileKey: { bsonType: ['string', 'null'] },
            url: { bsonType: ['string', 'null'] },
            description: { bsonType: ['string', 'null'] }
          }
        }
      },
      createAt: {
        bsonType: ['string', 'date'],
        description: '建立時間'
      }
    }
  },
  validationLevel: 'moderate', // 或 "strict"
  validationAction: 'error' // 違反則拒絕寫入
}
