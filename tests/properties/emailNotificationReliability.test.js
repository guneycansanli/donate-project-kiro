/**
 * Property-Based Tests for Email Notification Reliability
 * **Feature: donation-website, Property 3: Email Notification Reliability**
 * **Validates: Requirements 1.3**
 */

const fc = require('fast-check')
const EmailService = require('../../backend/services/emailService')

describe('Email Notification Reliability Properties', () => {
  let emailService

  beforeEach(async () => {
    emailService = new EmailService()
    await emailService.initialize()
  })

  /**
   * Property 3: Email Notification Reliability
   * For any successful donation, the system should trigger email sending
   * with correct recipient and donation details
   */
  test('Property 3: Email notification contains correct donation details', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 1, max: 1000 }).filter(n => !isNaN(n) && isFinite(n)), // donation amount
        fc.constantFrom('USD', 'EUR', 'GBP', 'CAD'), // currency codes
        fc.integer({ min: 1, max: 2000 }), // trees count
        fc.constantFrom('test@example.com', 'donor@test.org'), // valid recipient emails
        fc.constantFrom('txn-123', 'txn-456', 'txn-789'), // transaction ID
        fc.constantFrom('payer-abc', 'payer-def', 'payer-xyz'), // payer ID
        async (amount, currency, trees, recipientEmail, transactionId, payerId) => {
          const donationData = {
            amount,
            currency,
            trees,
            timestamp: new Date().toISOString(),
            transaction_id: transactionId,
            payer_id: payerId
          }

          // Property: Email service should accept valid donation data
          const result = await emailService.sendDonationReceipt(donationData, recipientEmail)

          // Property: Email sending should succeed with valid inputs
          expect(result.success).toBe(true)
          expect(result.recipient).toBe(recipientEmail)
          expect(result.messageId).toBeDefined()

          // Property: Generated email template should contain donation details
          const htmlTemplate = await emailService.generateReceiptTemplate(donationData)

          // Property: Template must contain formatted amount
          expect(htmlTemplate).toContain(`${currency} ${amount.toFixed(2)}`)

          // Property: Template must contain trees count
          expect(htmlTemplate).toContain(`${trees} trees`)

          // Property: Template must contain transaction ID
          expect(htmlTemplate).toContain(transactionId)

          // Property: Template must contain payer ID
          expect(htmlTemplate).toContain(payerId)

          // Property: Plain text version should also contain key details
          const plainText = emailService.generatePlainTextReceipt(donationData)
          expect(plainText).toContain(`${currency} ${amount.toFixed(2)}`)
          expect(plainText).toContain(`${trees} trees`)

          // Property: Both templates should contain organization branding
          expect(htmlTemplate).toContain('Give Green, Live Clean')
          expect(plainText).toContain('GIVE GREEN, LIVE CLEAN')
        }
      ),
      { numRuns: 20 }
    )
  })

  /**
   * Property: Email validation prevents invalid recipients
   * For any invalid email address, the system should reject the email sending
   */
  test('Property: Email validation rejects invalid email addresses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('invalid-email', 'test@', '@domain.com', '', 'test@domain'),
        fc.float({ min: 1, max: 100 }).filter(n => !isNaN(n) && isFinite(n)),
        async (invalidEmail, amount) => {
          const donationData = {
            amount,
            currency: 'USD',
            trees: Math.floor(amount * 2),
            timestamp: new Date().toISOString()
          }

          // Property: Invalid emails should be rejected
          await expect(emailService.sendDonationReceipt(donationData, invalidEmail))
            .rejects.toThrow(/Invalid email address format|Recipient email is required/)

          // Property: Email validation function should correctly identify invalid emails
          expect(emailService.validateEmail(invalidEmail)).toBe(false)
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property: Null/undefined email validation
   */
  test('Property: Null and undefined emails are rejected', async () => {
    const donationData = {
      amount: 25,
      currency: 'USD',
      trees: 50,
      timestamp: new Date().toISOString()
    }

    await expect(emailService.sendDonationReceipt(donationData, null))
      .rejects.toThrow('Recipient email is required')

    await expect(emailService.sendDonationReceipt(donationData, undefined))
      .rejects.toThrow('Recipient email is required')
  })

  /**
   * Property: Email content consistency across different donation amounts
   * For any valid donation amount, the email should maintain consistent structure
   */
  test('Property: Email content structure is consistent across donation amounts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.float({ min: 1, max: 100 }).filter(n => !isNaN(n) && isFinite(n)),
          { minLength: 2, maxLength: 3 }
        ),
        async (amounts) => {
          const recipientEmail = 'test@example.com'
          const emailResults = []
          const templates = []

          // Generate emails for different amounts
          for (const amount of amounts) {
            const donationData = {
              amount,
              currency: 'USD',
              trees: Math.floor(amount * 2),
              timestamp: new Date().toISOString(),
              transaction_id: 'txn-test'
            }

            const result = await emailService.sendDonationReceipt(donationData, recipientEmail)
            const template = await emailService.generateReceiptTemplate(donationData)

            emailResults.push(result)
            templates.push({ amount, template })
          }

          // Property: All emails should be sent successfully
          emailResults.forEach(result => {
            expect(result.success).toBe(true)
            expect(result.recipient).toBe(recipientEmail)
            expect(result.messageId).toBeDefined()
          })

          // Property: All templates should contain consistent structure elements
          templates.forEach(({ template }) => {
            // Essential structure elements that should be in every email
            expect(template).toContain('Thank You for Your Donation!')
            expect(template).toContain('Give Green, Live Clean')
            expect(template).toContain('Environmental Impact')
            expect(template).toContain('trees will be planted')
            expect(template).toContain('support@givegreenliveclean.org')

            // HTML structure elements
            expect(template).toContain('<html')
            expect(template).toContain('</html>')
            expect(template).toContain('<body')
            expect(template).toContain('</body>')
          })

          // Property: Amount-specific content should be accurate for each template
          templates.forEach(({ amount, template }) => {
            expect(template).toContain(`USD ${amount.toFixed(2)}`)
            expect(template).toContain(`${Math.floor(amount * 2)} trees`)
          })
        }
      ),
      { numRuns: 5 }
    )
  })

  /**
   * Property: Email service handles missing optional fields gracefully
   * For any donation with missing optional fields, email should still be generated
   */
  test('Property: Email generation handles missing optional fields gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 1, max: 100 }).filter(n => !isNaN(n) && isFinite(n)),
        fc.boolean(), // whether to include transaction_id
        fc.boolean(), // whether to include payer_id
        async (amount, includeTransactionId, includePayerId) => {
          const recipientEmail = 'test@example.com'
          const donationData = {
            amount,
            currency: 'USD',
            trees: Math.floor(amount * 2),
            timestamp: new Date().toISOString()
          }

          // Conditionally add optional fields
          if (includeTransactionId) {
            donationData.transaction_id = 'txn-test123'
          }
          if (includePayerId) {
            donationData.payer_id = 'payer-test456'
          }

          // Property: Email should be sent successfully regardless of optional fields
          const result = await emailService.sendDonationReceipt(donationData, recipientEmail)
          expect(result.success).toBe(true)
          expect(result.recipient).toBe(recipientEmail)

          // Property: Template should be generated successfully
          const htmlTemplate = await emailService.generateReceiptTemplate(donationData)
          const plainText = emailService.generatePlainTextReceipt(donationData)

          // Property: Required fields should always be present
          expect(htmlTemplate).toContain(`USD ${amount.toFixed(2)}`)
          expect(htmlTemplate).toContain(`${Math.floor(amount * 2)} trees`)
          expect(plainText).toContain(`USD ${amount.toFixed(2)}`)
          expect(plainText).toContain(`${Math.floor(amount * 2)} trees`)

          // Property: Optional fields should only appear when provided
          if (includeTransactionId) {
            expect(htmlTemplate).toContain('txn-test123')
            expect(plainText).toContain('txn-test123')
          }
          if (includePayerId) {
            expect(htmlTemplate).toContain('payer-test456')
            expect(plainText).toContain('payer-test456')
          }

          // Property: Templates should be valid HTML and text
          expect(htmlTemplate).toContain('<html')
          expect(htmlTemplate).toContain('</html>')
          expect(plainText.length).toBeGreaterThan(100) // Reasonable minimum length
        }
      ),
      { numRuns: 20 }
    )
  })

  /**
   * Property: Admin notification behavior is consistent
   * For any donation, admin notification should behave predictably
   */
  test('Property: Admin notification behavior is consistent with configuration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 1, max: 100 }).filter(n => !isNaN(n) && isFinite(n)),
        fc.boolean(), // whether admin email is configured
        async (amount, hasAdminEmail) => {
          const donationData = {
            amount,
            currency: 'USD',
            trees: Math.floor(amount * 2),
            timestamp: new Date().toISOString(),
            transaction_id: 'txn-test'
          }

          // Set or unset admin email based on test parameter
          const originalAdminEmail = process.env.ADMIN_EMAIL
          if (hasAdminEmail) {
            process.env.ADMIN_EMAIL = 'admin@givegreenliveclean.org'
          } else {
            delete process.env.ADMIN_EMAIL
          }

          try {
            const result = await emailService.sendAdminNotification(donationData)

            if (hasAdminEmail) {
              // Property: Admin notification should succeed when email is configured
              expect(result.success).toBe(true)
              expect(result.messageId).toBeDefined()
            } else {
              // Property: Admin notification should fail gracefully when no email configured
              expect(result.success).toBe(false)
              expect(result.reason).toBe('Admin email not configured')
            }
          } finally {
            // Restore original admin email setting
            if (originalAdminEmail) {
              process.env.ADMIN_EMAIL = originalAdminEmail
            } else {
              delete process.env.ADMIN_EMAIL
            }
          }
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property: Email service connection testing is consistent
   * For any email service instance, connection testing should behave predictably
   */
  test('Property: Email service connection testing behaves consistently', async () => {
    // Property: Mock transporter should consistently return false for connection test
    const connectionResult1 = await emailService.testConnection()
    const connectionResult2 = await emailService.testConnection()

    expect(connectionResult1).toBe(connectionResult2)
    expect(connectionResult1).toBe(false) // Mock transporter doesn't have real verify method
  })

  /**
   * Property: Email address validation is consistent and correct
   * For any email address, validation should always return the same result
   */
  test('Property: Email validation is consistent and follows RFC standards', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constantFrom('test@example.com', 'user@domain.org', 'valid@test.net'), // valid emails
          fc.constantFrom('invalid-email', 'test@', '@domain.com', '', 'test@domain') // invalid emails
        ),
        (emailCandidate) => {
          // Property: Validation should be consistent
          const result1 = emailService.validateEmail(emailCandidate)
          const result2 = emailService.validateEmail(emailCandidate)
          expect(result1).toBe(result2)

          // Property: Known valid emails should pass
          if (['test@example.com', 'user@domain.org', 'valid@test.net'].includes(emailCandidate)) {
            expect(result1).toBe(true)
          }

          // Property: Known invalid emails should fail
          if (['invalid-email', 'test@', '@domain.com', '', 'test@domain'].includes(emailCandidate)) {
            expect(result1).toBe(false)
          }
        }
      ),
      { numRuns: 50 }
    )
  })
})
