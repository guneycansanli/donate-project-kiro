/**
 * Integration tests for email service functionality
 */

const EmailService = require('../../backend/services/emailService');

describe('Email Service Integration Tests', () => {
  let emailService;

  beforeEach(() => {
    emailService = new EmailService();
  });

  describe('Email Service Initialization', () => {
    test('should initialize with mock transporter when no SMTP credentials', async () => {
      await emailService.initialize();
      expect(emailService.transporter).toBeDefined();
    });

    test('should validate email addresses correctly', () => {
      expect(emailService.validateEmail('test@example.com')).toBe(true);
      expect(emailService.validateEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(emailService.validateEmail('invalid-email')).toBe(false);
      expect(emailService.validateEmail('test@')).toBe(false);
      expect(emailService.validateEmail('@domain.com')).toBe(false);
      expect(emailService.validateEmail('')).toBe(false);
    });
  });

  describe('Donation Receipt Email', () => {
    beforeEach(async () => {
      await emailService.initialize();
    });

    test('should send donation receipt with valid data', async () => {
      const donationData = {
        amount: 25.00,
        currency: 'USD',
        trees: 50,
        timestamp: new Date().toISOString(),
        transaction_id: 'test-txn-123',
        payer_id: 'test-payer-456'
      };

      const result = await emailService.sendDonationReceipt(donationData, 'donor@example.com');

      expect(result.success).toBe(true);
      expect(result.recipient).toBe('donor@example.com');
      expect(result.messageId).toBeDefined();
    });

    test('should reject invalid email addresses', async () => {
      const donationData = {
        amount: 25.00,
        currency: 'USD',
        trees: 50,
        timestamp: new Date().toISOString()
      };

      await expect(emailService.sendDonationReceipt(donationData, 'invalid-email'))
        .rejects.toThrow('Invalid email address format');
    });

    test('should handle missing recipient email', async () => {
      const donationData = {
        amount: 25.00,
        currency: 'USD',
        trees: 50,
        timestamp: new Date().toISOString()
      };

      await expect(emailService.sendDonationReceipt(donationData, null))
        .rejects.toThrow('Recipient email is required');
    });
  });

  describe('Email Template Generation', () => {
    beforeEach(async () => {
      await emailService.initialize();
    });

    test('should generate HTML template with donation data', async () => {
      const donationData = {
        amount: 100.00,
        currency: 'USD',
        trees: 200,
        timestamp: new Date().toISOString(),
        transaction_id: 'test-txn-789'
      };

      const template = await emailService.generateReceiptTemplate(donationData);

      expect(template).toContain('Thank You for Your Donation!');
      expect(template).toContain('USD 100.00');
      expect(template).toContain('200 trees');
      expect(template).toContain('test-txn-789');
      expect(template).toContain('Give Green, Live Clean');
    });

    test('should generate plain text receipt', () => {
      const donationData = {
        amount: 50.00,
        currency: 'USD',
        trees: 100,
        timestamp: new Date().toISOString(),
        transaction_id: 'test-txn-456'
      };

      const plainText = emailService.generatePlainTextReceipt(donationData);

      expect(plainText).toContain('DONATION RECEIPT');
      expect(plainText).toContain('USD 50.00');
      expect(plainText).toContain('100 trees');
      expect(plainText).toContain('test-txn-456');
      expect(plainText).toContain('Give Green, Live Clean');
    });

    test('should handle optional fields gracefully', async () => {
      const donationData = {
        amount: 25.00,
        currency: 'USD',
        trees: 50,
        timestamp: new Date().toISOString()
        // No transaction_id or payer_id
      };

      const template = await emailService.generateReceiptTemplate(donationData);
      const plainText = emailService.generatePlainTextReceipt(donationData);

      expect(template).toContain('USD 25.00');
      expect(template).toContain('50 trees');
      expect(plainText).toContain('USD 25.00');
      expect(plainText).toContain('50 trees');
    });
  });

  describe('Admin Notification', () => {
    beforeEach(async () => {
      await emailService.initialize();
    });

    test('should skip admin notification when no admin email configured', async () => {
      const donationData = {
        amount: 75.00,
        currency: 'USD',
        trees: 150,
        timestamp: new Date().toISOString()
      };

      const result = await emailService.sendAdminNotification(donationData);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Admin email not configured');
    });

    test('should send admin notification when admin email is configured', async () => {
      // Temporarily set admin email
      process.env.ADMIN_EMAIL = 'admin@example.com';

      const donationData = {
        amount: 75.00,
        currency: 'USD',
        trees: 150,
        timestamp: new Date().toISOString(),
        transaction_id: 'test-admin-txn'
      };

      const result = await emailService.sendAdminNotification(donationData);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();

      // Clean up
      delete process.env.ADMIN_EMAIL;
    });
  });

  describe('Connection Testing', () => {
    test('should return false for mock transporter connection test', async () => {
      await emailService.initialize();
      const isHealthy = await emailService.testConnection();
      expect(isHealthy).toBe(false); // Mock transporter doesn't have verify method
    });
  });
});