exports.productJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'procudtNameMain',
      'procudtNameSub',
      'category',
      'price',
      'inStock',
      'enable',
      'mainPhoto',
      'createAt'
    ],
    additionalProperties: false,
    properties: {
      _id: { bsonType: 'objectId' },
      procudtNameMain: {
        bsonType: 'string',
        description: '必填，商品主名稱'
      },
      procudtNameSub: {
        bsonType: ['string', 'null'],
        description: '必填，商品副名稱'
      },
      category: {
        bsonType: 'string',
        enum: ['0', '1', '2'],
        description: '必填，商品分類  0 碗, 1 瓶子, 2 杯子'
      },
      price: {
        bsonType: ['int', 'long', 'double', 'decimal'],
        minimum: 0,
        description: '必填，價格 >= 0'
      },
      size: {
        bsonType: ['string', 'null'],
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
        required: ['createAt', 'fileKey', 'url'],
        additionalProperties: false,
        properties: {
          createAt: {
            bsonType: ['string', 'date', 'null'],
            description: '主圖建立時間'
          },
          fileKey: {
            bsonType: ['string', 'null'],
            description: 'S3 檔案 key，可為 null'
          },
          url: {
            bsonType: ['string', 'null'],
            description: 'S3 檔案 URL，可為 null'
          }
        }
      },
      subPhotos: {
        bsonType: 'array',
        description: '次要圖片陣列',
        items: {
          bsonType: 'object',
          required: ['createAt', 'fileKey', 'url'],
          additionalProperties: false,
          properties: {
            _id: { bsonType: 'objectId' },
            createAt: { bsonType: ['string', 'date', 'null'] },
            fileKey: { bsonType: ['string', 'null'] },
            url: { bsonType: ['string', 'null'] }
          }
        }
      },
      createAt: {
        bsonType: ['string', 'date'],
        description: '建立時間'
      }
    }
  }
}
