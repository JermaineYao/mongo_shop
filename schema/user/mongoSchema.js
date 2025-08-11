exports.userJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['account', 'email', 'role', 'active', 'pwd'],
    additionalProperties: false,
    properties: {
      account: {
        bsonType: 'string',
        pattern: '^[a-zA-Z][a-zA-Z0-9]*$',
        description: '必填，用戶名稱'
      },
      email: {
        bsonType: 'string',
        pattern: '^.+@.+\\..+$',
        description: '必填，且應為合法 email 格式'
      },
      role: {
        bsonType: 'string',
        enum: ['user', 'admin'],
        description: '使用者角色，只能是 user 或 admin'
      },
      active: { bsonType: 'bool' },
      photo: {
        bsonType: 'object',
        additionalProperties: false,
        properties: {
          createAt: { bsonType: ['string', 'null'] },
          fileKey: { bsonType: ['string', 'null'] },
          url: { bsonType: ['string', 'null'] }
        },
        description: '使用者頭像資料'
      },
      phoneNumber: { bsonType: ['string', 'null'] },
      address: { bsonType: ['string', 'null'] },
      pwd: {
        bsonType: 'string',
        pattern: '^.{8,}$',
        description: '加密後密碼 bcrypt hash'
      },
      createAt: {
        bsonType: 'string',
        description: '創建時間 yyyy-MM-dd hh:mm:ss'
      },
      pwdChangeAt: {
        bsonType: 'string',
        description: '密碼變更時間 yyyy-MM-dd hh:mm:ss'
      },
      modifiedAt: {
        bsonType: ['string', 'null'],
        description: '帳號圖片, 電話, 地址變更時間 yyyy-MM-dd hh:mm:ss'
      },
      disabledAt: {
        bsonType: ['string', 'null'],
        description: '密碼變更時間 yyyy-MM-dd hh:mm:ss'
      },
      pwdResetToken: {
        bsonType: ['string', 'null'],
        description: '加密後重置密碼 bcrypt hash'
      },
      pwdResetExpires: {
        bsonType: ['date', 'null'],
        description: '重置密碼時效'
      }
    }
  },
  validationLevel: 'moderate', // 或 "strict"
  validationAction: 'error' // 違反則拒絕寫入
}
