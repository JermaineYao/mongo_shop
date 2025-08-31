const nodemailer = require('nodemailer')
const pug = require('pug')
const { convert } = require('html-to-text')

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email
    this.from = `陶釉工房 <${process.env.EMAIL_FROM}>`
    this.account = user.account
    this.url = url
  }

  newTransport() {
    return nodemailer.createTransport({
      service: 'gmail',
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    })
  }

  async send(template = null, subject) {
    let html
    if (template) {
      html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
        account: this.account,
        url: this.url,
        subject
      })
    }

    const mailOption = template
      ? {
          from: this.from,
          to: this.to,
          subject,
          html,
          text: convert(html, {
            wordwrap: false
          })
        }
      : {
          from: this.from,
          to: this.to,
          subject,
          text: this.url
        }

    await this.newTransport().sendMail(mailOption)
  }
}
