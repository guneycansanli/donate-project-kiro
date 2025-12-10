const nodemailer = require('nodemailer')

/**
 * Email Service for sending donation receipts and notifications
 */
class EmailService {
  constructor () {
    this.transporter = null
    this.emailConfig = {
      // Default configuration - should be overridden by environment variables
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true' || false,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    }
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@givegreenliveclean.org'
    this.fromName = process.env.FROM_NAME || 'Give Green, Live Clean'
  }

  /**
     * Initialize the email service
     */
  async initialize () {
    try {
      // Only initialize if SMTP credentials are provided
      if (this.emailConfig.auth.user && this.emailConfig.auth.pass) {
        this.transporter = nodemailer.createTransporter(this.emailConfig)

        // Verify connection
        await this.transporter.verify()
        console.log('Email service initialized successfully')
      } else {
        console.warn('Email service not configured - SMTP credentials missing')
        // Create a mock transporter for development
        this.transporter = {
          sendMail: async (mailOptions) => {
            console.log('Mock email sent:', {
              to: mailOptions.to,
              subject: mailOptions.subject,
              timestamp: new Date().toISOString()
            })
            return { messageId: 'mock-' + Date.now() }
          }
        }
      }
    } catch (error) {
      console.error('Failed to initialize email service:', error)
      // Create a fallback mock transporter
      this.transporter = {
        sendMail: async (mailOptions) => {
          console.log('Fallback mock email:', mailOptions.subject)
          return { messageId: 'fallback-' + Date.now() }
        }
      }
    }
  }

  /**
     * Send donation receipt email
     * @param {Object} donationData - Donation details
     * @param {string} recipientEmail - Recipient email address
     * @returns {Promise<Object>} Email sending result
     */
  async sendDonationReceipt (donationData, recipientEmail) {
    try {
      if (!recipientEmail) {
        throw new Error('Recipient email is required')
      }

      if (!this.validateEmail(recipientEmail)) {
        throw new Error('Invalid email address format')
      }

      const emailTemplate = await this.generateReceiptTemplate(donationData)

      const mailOptions = {
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: recipientEmail,
        subject: `Thank you for your donation - Receipt #${donationData.transaction_id || 'PENDING'}`,
        html: emailTemplate,
        text: this.generatePlainTextReceipt(donationData)
      }

      const result = await this.transporter.sendMail(mailOptions)

      console.log('Donation receipt sent successfully:', {
        messageId: result.messageId,
        recipient: recipientEmail,
        amount: donationData.amount
      })

      return {
        success: true,
        messageId: result.messageId,
        recipient: recipientEmail
      }
    } catch (error) {
      console.error('Failed to send donation receipt:', error)
      throw error
    }
  }

  /**
     * Generate HTML email template for donation receipt
     * @param {Object} donationData - Donation details
     * @returns {Promise<string>} HTML email template
     */
  async generateReceiptTemplate (donationData) {
    const {
      amount,
      currency = 'USD',
      trees,
      timestamp,
      transaction_id: transactionId,
      payer_id: payerId
    } = donationData

    const formattedDate = new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Donation Receipt - Give Green, Live Clean</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f8f5;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #0df20d;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #0df20d;
            margin-bottom: 10px;
        }
        .title {
            font-size: 28px;
            font-weight: bold;
            color: #102210;
            margin: 0;
        }
        .amount-section {
            background: linear-gradient(135deg, #0df20d, #0aa00a);
            color: white;
            padding: 30px;
            border-radius: 8px;
            text-align: center;
            margin: 30px 0;
        }
        .amount {
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .impact {
            font-size: 18px;
            opacity: 0.9;
        }
        .details {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e9ecef;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .detail-label {
            font-weight: 600;
            color: #495057;
        }
        .detail-value {
            color: #212529;
        }
        .impact-section {
            background: #e8f5e8;
            padding: 25px;
            border-radius: 8px;
            margin: 30px 0;
        }
        .impact-title {
            font-size: 20px;
            font-weight: bold;
            color: #102210;
            margin-bottom: 15px;
        }
        .impact-list {
            list-style: none;
            padding: 0;
        }
        .impact-list li {
            padding: 8px 0;
            position: relative;
            padding-left: 25px;
        }
        .impact-list li:before {
            content: "🌱";
            position: absolute;
            left: 0;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            color: #6c757d;
            font-size: 14px;
        }
        .social-links {
            margin: 20px 0;
        }
        .social-links a {
            color: #0df20d;
            text-decoration: none;
            margin: 0 10px;
        }
        @media (max-width: 600px) {
            body {
                padding: 10px;
            }
            .container {
                padding: 20px;
            }
            .amount {
                font-size: 28px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🌲 Give Green, Live Clean</div>
            <h1 class="title">Thank You for Your Donation!</h1>
        </div>

        <div class="amount-section">
            <div class="amount">${currency} ${amount.toFixed(2)}</div>
            <div class="impact">Will plant approximately ${trees} trees</div>
        </div>

        <p>Dear Environmental Champion,</p>
        
        <p>Thank you for your generous donation to Give Green, Live Clean! Your contribution is making a real difference in our mission to reforest the planet and create a healthier world for future generations.</p>

        <div class="details">
            <div class="detail-row">
                <span class="detail-label">Donation Amount:</span>
                <span class="detail-value">${currency} ${amount.toFixed(2)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Trees to be Planted:</span>
                <span class="detail-value">${trees} trees</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${formattedDate}</span>
            </div>
            ${transactionId
? `
            <div class="detail-row">
                <span class="detail-label">Transaction ID:</span>
                <span class="detail-value">${transactionId}</span>
            </div>
            `
: ''}
            ${payerId
? `
            <div class="detail-row">
                <span class="detail-label">Payer ID:</span>
                <span class="detail-value">${payerId}</span>
            </div>
            `
: ''}
        </div>

        <div class="impact-section">
            <div class="impact-title">Your Environmental Impact</div>
            <ul class="impact-list">
                <li>Your trees will be planted within the next 30 days</li>
                <li>Each tree will absorb approximately 48 lbs of CO₂ per year</li>
                <li>Your contribution supports local communities and biodiversity</li>
                <li>You'll receive updates on your environmental impact</li>
            </ul>
        </div>

        <p>We'll keep you updated on the progress of your tree planting project. You can also visit our website anytime to see the latest statistics on our global reforestation efforts.</p>

        <p>Together, we're making the world greener, one tree at a time!</p>

        <p>With gratitude,<br>
        <strong>The Give Green, Live Clean Team</strong></p>

        <div class="footer">
            <div class="social-links">
                <a href="#">Follow us on Facebook</a> |
                <a href="#">Follow us on Twitter</a> |
                <a href="#">Visit our website</a>
            </div>
            <p>This is an automated receipt. Please keep this email for your records.</p>
            <p>Give Green, Live Clean | Environmental Restoration Initiative</p>
            <p>If you have any questions, please contact us at support@givegreenliveclean.org</p>
        </div>
    </div>
</body>
</html>
        `
  }

  /**
     * Generate plain text version of donation receipt
     * @param {Object} donationData - Donation details
     * @returns {string} Plain text email content
     */
  generatePlainTextReceipt (donationData) {
    const {
      amount,
      currency = 'USD',
      trees,
      timestamp,
      transaction_id: transactionId,
      payer_id: payerId
    } = donationData

    const formattedDate = new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    return `
GIVE GREEN, LIVE CLEAN - DONATION RECEIPT

Thank you for your donation!

DONATION DETAILS:
Amount: ${currency} ${amount.toFixed(2)}
Trees to be planted: ${trees} trees
Date: ${formattedDate}
${transactionId ? `Transaction ID: ${transactionId}` : ''}
${payerId ? `Payer ID: ${payerId}` : ''}

YOUR ENVIRONMENTAL IMPACT:
- Your trees will be planted within the next 30 days
- Each tree will absorb approximately 48 lbs of CO₂ per year
- Your contribution supports local communities and biodiversity
- You'll receive updates on your environmental impact

We'll keep you updated on the progress of your tree planting project. You can also visit our website anytime to see the latest statistics on our global reforestation efforts.

Together, we're making the world greener, one tree at a time!

With gratitude,
The Give Green, Live Clean Team

---
This is an automated receipt. Please keep this email for your records.
Give Green, Live Clean | Environmental Restoration Initiative
If you have any questions, please contact us at support@givegreenliveclean.org
        `.trim()
  }

  /**
     * Send notification email to administrators
     * @param {Object} donationData - Donation details
     * @returns {Promise<Object>} Email sending result
     */
  async sendAdminNotification (donationData) {
    try {
      const adminEmail = process.env.ADMIN_EMAIL
      if (!adminEmail) {
        console.warn('Admin email not configured, skipping notification')
        return { success: false, reason: 'Admin email not configured' }
      }

      const mailOptions = {
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: adminEmail,
        subject: `New Donation Received - ${donationData.currency} ${donationData.amount}`,
        html: `
                    <h2>New Donation Received</h2>
                    <p><strong>Amount:</strong> ${donationData.currency} ${donationData.amount}</p>
                    <p><strong>Trees:</strong> ${donationData.trees}</p>
                    <p><strong>Date:</strong> ${new Date(donationData.timestamp).toLocaleString()}</p>
                    <p><strong>Transaction ID:</strong> ${donationData.transaction_id || 'N/A'}</p>
                    <p><strong>Payer ID:</strong> ${donationData.payer_id || 'N/A'}</p>
                `,
        text: `
New Donation Received

Amount: ${donationData.currency} ${donationData.amount}
Trees: ${donationData.trees}
Date: ${new Date(donationData.timestamp).toLocaleString()}
Transaction ID: ${donationData.transaction_id || 'N/A'}
Payer ID: ${donationData.payer_id || 'N/A'}
                `.trim()
      }

      const result = await this.transporter.sendMail(mailOptions)

      console.log('Admin notification sent successfully:', result.messageId)
      return { success: true, messageId: result.messageId }
    } catch (error) {
      console.error('Failed to send admin notification:', error)
      return { success: false, error: error.message }
    }
  }

  /**
     * Validate email address format
     * @param {string} email - Email address to validate
     * @returns {boolean} True if valid email format
     */
  validateEmail (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
     * Test email configuration
     * @returns {Promise<boolean>} True if email service is working
     */
  async testConnection () {
    try {
      if (this.transporter && typeof this.transporter.verify === 'function') {
        await this.transporter.verify()
        return true
      }
      return false
    } catch (error) {
      return false
    }
  }
}

module.exports = EmailService
