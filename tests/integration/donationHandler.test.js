/**
 * Integration tests for donation success and error handling
 */

const { JSDOM } = require('jsdom');

describe('Donation Handler Integration Tests', () => {
    let dom;
    let window;
    let document;
    let DonationHandler;

    beforeEach(() => {
        // Set up DOM environment
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <head>
                <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">
            </head>
            <body>
                <div id="paypal-donation-form">
                    <input id="paypal-amount" value="25.00" />
                </div>
            </body>
            </html>
        `, {
            url: 'http://localhost:3000',
            pretendToBeVisual: true,
            resources: 'usable'
        });

        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;
        global.localStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        // Mock fetch
        global.fetch = jest.fn();

        // Load the donation handler class
        const donationHandlerCode = require('fs').readFileSync(
            require('path').join(__dirname, '../../frontend/js/donationHandler.js'),
            'utf8'
        );
        
        // Execute the code in the JSDOM context
        const script = new window.Function(donationHandlerCode);
        script.call(window);
        
        DonationHandler = window.DonationHandler;
    });

    afterEach(() => {
        dom.window.close();
        jest.clearAllMocks();
    });

    describe('Donation Success Handling', () => {
        test('should handle successful donation with email notification', async () => {
            const handler = new DonationHandler();
            
            // Mock successful email API response
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    success: true,
                    message: 'Receipt email sent successfully'
                })
            });

            // Mock statistics engine
            window.statisticsEngine = {
                incrementStatistics: jest.fn().mockResolvedValue(true)
            };

            const donationData = {
                amount: 25.00,
                currency: 'USD',
                trees: 50,
                timestamp: new Date().toISOString(),
                transaction_id: 'test-txn-123'
            };

            await handler.handleDonationSuccess(donationData);

            // Verify email API was called
            expect(global.fetch).toHaveBeenCalledWith('/api/donations/email-receipt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount: 25.00,
                    currency: 'USD',
                    trees: 50,
                    timestamp: donationData.timestamp,
                    transactionId: 'test-txn-123',
                    payerId: undefined
                })
            });

            // Verify statistics were updated
            expect(window.statisticsEngine.incrementStatistics).toHaveBeenCalledWith(25.00);

            // Verify success modal is created
            const modal = document.querySelector('[id^="donation-modal-success"]');
            expect(modal).toBeTruthy();
            expect(modal.innerHTML).toContain('Thank You for Your Donation!');
            expect(modal.innerHTML).toContain('$25');
            expect(modal.innerHTML).toContain('50 trees');
        });

        test('should handle donation success even if email fails', async () => {
            const handler = new DonationHandler();
            
            // Mock failed email API response
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 500
            });

            // Mock statistics engine
            window.statisticsEngine = {
                incrementStatistics: jest.fn().mockResolvedValue(true)
            };

            const donationData = {
                amount: 50.00,
                currency: 'USD',
                trees: 100,
                timestamp: new Date().toISOString()
            };

            // Should not throw error even if email fails
            await expect(handler.handleDonationSuccess(donationData)).resolves.not.toThrow();

            // Verify statistics were still updated
            expect(window.statisticsEngine.incrementStatistics).toHaveBeenCalledWith(50.00);

            // Verify success modal is still created
            const modal = document.querySelector('[id^="donation-modal-success"]');
            expect(modal).toBeTruthy();
        });
    });

    describe('Donation Error Handling', () => {
        test('should show error modal for payment failures', () => {
            const handler = new DonationHandler();

            const errorData = {
                type: 'payment_failed',
                message: 'Payment could not be processed'
            };

            handler.handleDonationError(errorData);

            // Verify error modal is created
            const modal = document.querySelector('[id^="donation-modal-error"]');
            expect(modal).toBeTruthy();
            expect(modal.innerHTML).toContain('Payment Failed');
            expect(modal.innerHTML).toContain('Try Again');
        });

        test('should show error modal for network errors', () => {
            const handler = new DonationHandler();

            const errorData = {
                type: 'network_error'
            };

            handler.handleDonationError(errorData);

            // Verify error modal is created
            const modal = document.querySelector('[id^="donation-modal-error"]');
            expect(modal).toBeTruthy();
            expect(modal.innerHTML).toContain('Connection Error');
            expect(modal.innerHTML).toContain('Check your internet connection');
        });

        test('should show default error for unknown error types', () => {
            const handler = new DonationHandler();

            const errorData = {
                type: 'unknown_error'
            };

            handler.handleDonationError(errorData);

            // Verify error modal is created with default message
            const modal = document.querySelector('[id^="donation-modal-error"]');
            expect(modal).toBeTruthy();
            expect(modal.innerHTML).toContain('Server Error');
        });
    });

    describe('Form Submission Handling', () => {
        test('should prevent submission with invalid amount', () => {
            const handler = new DonationHandler();
            
            // Create form with invalid amount
            const form = document.createElement('form');
            form.id = 'paypal-donation-form';
            form.innerHTML = '<input id="paypal-amount" value="0" />';
            document.body.appendChild(form);

            const event = new window.Event('submit', { bubbles: true, cancelable: true });
            let defaultPrevented = false;
            event.preventDefault = () => { defaultPrevented = true; };

            Object.defineProperty(event, 'target', { value: form });

            handler.handleDonationSubmission(event);

            // Verify submission was prevented
            expect(defaultPrevented).toBe(true);

            // Verify error notification is shown
            const notification = document.querySelector('.notification');
            expect(notification).toBeTruthy();
            expect(notification.innerHTML).toContain('Invalid Amount');
        });

        test('should store donation attempt for valid submission', () => {
            const handler = new DonationHandler();
            
            // Create form with valid amount
            const form = document.createElement('form');
            form.id = 'paypal-donation-form';
            form.innerHTML = '<input id="paypal-amount" value="25.00" />';
            document.body.appendChild(form);

            const event = new window.Event('submit', { bubbles: true, cancelable: true });
            Object.defineProperty(event, 'target', { value: form });

            handler.handleDonationSubmission(event);

            // Verify donation attempt was stored
            expect(global.localStorage.setItem).toHaveBeenCalledWith(
                'pendingDonation',
                expect.stringContaining('"amount":25')
            );
        });
    });

    describe('URL Parameter Handling', () => {
        test('should handle PayPal success return', () => {
            // Mock URL with success parameter
            Object.defineProperty(window, 'location', {
                value: {
                    search: '?success=1&tx=test-transaction&payer_id=test-payer'
                },
                writable: true
            });

            // Mock pending donation
            global.localStorage.getItem.mockReturnValue(JSON.stringify({
                amount: 25.00,
                trees: 50,
                timestamp: new Date().toISOString()
            }));

            const handler = new DonationHandler();
            
            // Mock the handleDonationSuccess method
            handler.handleDonationSuccess = jest.fn();

            // Trigger URL parameter handling
            handler.handleUrlParameters();

            // Verify success handler was called
            expect(handler.handleDonationSuccess).toHaveBeenCalledWith({
                paypal_return: true,
                transaction_id: 'test-transaction',
                payer_id: 'test-payer'
            });
        });

        test('should handle PayPal cancellation', () => {
            // Mock URL with cancelled parameter
            Object.defineProperty(window, 'location', {
                value: {
                    search: '?cancelled=1'
                },
                writable: true
            });

            const handler = new DonationHandler();

            // Trigger URL parameter handling
            handler.handleUrlParameters();

            // Verify pending donation was cleared
            expect(global.localStorage.removeItem).toHaveBeenCalledWith('pendingDonation');

            // Verify cancellation notification is shown
            const notification = document.querySelector('.notification');
            expect(notification).toBeTruthy();
            expect(notification.innerHTML).toContain('Donation Cancelled');
        });
    });

    describe('Modal Management', () => {
        test('should close modal when close button is clicked', () => {
            const handler = new DonationHandler();

            // Create and show a success modal
            const donationData = {
                amount: 25.00,
                trees: 50,
                timestamp: new Date().toISOString()
            };

            handler.showSuccessModal(donationData);

            // Verify modal exists
            let modal = document.querySelector('[id^="donation-modal-success"]');
            expect(modal).toBeTruthy();

            // Close modal
            handler.closeModal();

            // Verify modal is removed
            modal = document.querySelector('[id^="donation-modal-success"]');
            expect(modal).toBeFalsy();
        });

        test('should prevent body scroll when modal is open', () => {
            const handler = new DonationHandler();

            const donationData = {
                amount: 25.00,
                trees: 50,
                timestamp: new Date().toISOString()
            };

            handler.showSuccessModal(donationData);

            // Verify body scroll is prevented
            expect(document.body.style.overflow).toBe('hidden');

            handler.closeModal();

            // Verify body scroll is restored
            expect(document.body.style.overflow).toBe('');
        });
    });

    describe('Notification System', () => {
        test('should show and auto-remove notifications', (done) => {
            const handler = new DonationHandler();

            handler.showNotification({
                type: 'success',
                title: 'Test Success',
                message: 'This is a test notification',
                duration: 100 // Short duration for test
            });

            // Verify notification is shown
            const notification = document.querySelector('.notification');
            expect(notification).toBeTruthy();
            expect(notification.innerHTML).toContain('Test Success');

            // Wait for auto-removal
            setTimeout(() => {
                const removedNotification = document.querySelector('.notification');
                expect(removedNotification).toBeFalsy();
                done();
            }, 500);
        });

        test('should clear all notifications', () => {
            const handler = new DonationHandler();

            // Show multiple notifications
            handler.showNotification({
                type: 'success',
                title: 'Success 1',
                message: 'Message 1'
            });

            handler.showNotification({
                type: 'error',
                title: 'Error 1',
                message: 'Message 2'
            });

            // Verify notifications exist
            let notifications = document.querySelectorAll('.notification');
            expect(notifications.length).toBe(2);

            // Clear all notifications
            handler.clearNotifications();

            // Verify all notifications are removed
            notifications = document.querySelectorAll('.notification');
            expect(notifications.length).toBe(0);
        });
    });
});