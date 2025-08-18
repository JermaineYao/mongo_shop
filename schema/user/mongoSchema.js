exports.userJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['account', 'email', 'role', 'active', 'pwd'],
    additionalProperties: false,
    properties: {
      // 一定要允許 _id，否則 additionalProperties: false 會擋掉
      _id: { bsonType: 'objectId' },

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
          createAt: { bsonType: ['date', 'null'] },
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
        bsonType: ['date', 'null'],
        description: '創建時間 yyyy-MM-dd hh:mm:ss'
      },
      pwdChangeAt: {
        bsonType: ['date', 'null'],
        description: '密碼變更時間 yyyy-MM-dd hh:mm:ss'
      },
      modifiedAt: {
        bsonType: ['date', 'null'],
        description: '帳號圖片, 電話, 地址變更時間 yyyy-MM-dd hh:mm:ss'
      },
      disabledAt: {
        bsonType: ['date', 'null'],
        description: '停用時間 yyyy-MM-dd hh:mm:ss'
      },

      pwdResetToken: {
        bsonType: ['string', 'null'],
        description: '加密後重置密碼 token（hash 字串）'
      },
      pwdResetExpires: {
        bsonType: ['date', 'null'],
        description: '重置密碼時效'
      }
    }
  }
}
