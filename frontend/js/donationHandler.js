/**
 * Donation Success and Error Handler
 * Manages donation completion, error states, and email notifications
 */
class DonationHandler {
    constructor() {
        this.emailService = null;
        this.notificationContainer = null;
        this.init();
    }

    /**
     * Initialize the donation handler
     */
    init() {
        this.createNotificationContainer();
        this.bindEvents();
        this.handleUrlParameters();
    }

    /**
     * Create notification container for success/error messages
     */
    createNotificationContainer() {
        if (document.getElementById('donation-notifications')) return;

        const container = document.createElement('div');
        container.id = 'donation-notifications';
        container.className = 'fixed top-4 right-4 z-50 space-y-2';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-label', 'Donation notifications');
        document.body.appendChild(container);
        this.notificationContainer = container;
    }

    /**
     * Bind event listeners for donation handling
     */
    bindEvents() {
        // Listen for PayPal form submissions
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'paypal-donation-form') {
                this.handleDonationSubmission(e);
            }
        });

        // Listen for donation success events
        document.addEventListener('donationSuccess', (e) => {
            this.handleDonationSuccess(e.detail);
        });

        // Listen for donation error events
        document.addEventListener('donationError', (e) => {
            this.handleDonationError(e.detail);
        });
    }

    /**
     * Handle donation form submission
     * @param {Event} event - Form submission event
     */
    handleDonationSubmission(event) {
        const form = event.target;
        const amount = parseFloat(form.querySelector('#paypal-amount').value);

        if (!amount || amount <= 0) {
            event.preventDefault();
            this.showError({
                title: 'Invalid Amount',
                message: 'Please select a valid donation amount before proceeding.',
                type: 'validation'
            });
            return false;
        }

        // Store donation attempt for success tracking
        this.storeDonationAttempt({
            amount: amount,
            timestamp: new Date().toISOString(),
            trees: Math.floor(amount * 2),
            currency: 'USD'
        });

        // Show processing notification
        this.showProcessingNotification();
    }

    /**
     * Store donation attempt in localStorage
     * @param {Object} donationData - Donation details
     */
    storeDonationAttempt(donationData) {
        try {
            localStorage.setItem('pendingDonation', JSON.stringify(donationData));
        } catch (error) {
            console.warn('Failed to store donation attempt:', error);
        }
    }

    /**
     * Handle successful donation completion
     * @param {Object} donationData - Donation success details
     */
    async handleDonationSuccess(donationData) {
        try {
            // Clear any existing notifications
            this.clearNotifications();

            // Get pending donation data
            const pendingDonation = this.getPendingDonation();
            const finalDonationData = { ...pendingDonation, ...donationData };

            // Update statistics
            await this.updateStatistics(finalDonationData.amount);

            // Send email notification
            await this.sendEmailNotification(finalDonationData);

            // Show success modal/notification
            this.showSuccessModal(finalDonationData);

            // Clear pending donation
            this.clearPendingDonation();

            // Track success analytics
            this.trackDonationSuccess(finalDonationData);

        } catch (error) {
            console.error('Error processing donation success:', error);
            this.showError({
                title: 'Processing Error',
                message: 'Your donation was successful, but we encountered an issue processing it. Please contact support if you don\'t receive a confirmation email.',
                type: 'processing'
            });
        }
    }

    /**
     * Handle donation errors
     * @param {Object} errorData - Error details
     */
    handleDonationError(errorData) {
        this.clearNotifications();
        
        const errorMessages = {
            'payment_failed': {
                title: 'Payment Failed',
                message: 'Your payment could not be processed. Please check your payment method and try again.',
                suggestions: ['Verify your payment information', 'Try a different payment method', 'Contact your bank if the issue persists']
            },
            'network_error': {
                title: 'Connection Error',
                message: 'Unable to connect to payment services. Please check your internet connection and try again.',
                suggestions: ['Check your internet connection', 'Try refreshing the page', 'Wait a moment and try again']
            },
            'validation_error': {
                title: 'Invalid Information',
                message: 'Please check your donation information and try again.',
                suggestions: ['Verify the donation amount', 'Ensure all required fields are filled']
            },
            'server_error': {
                title: 'Server Error',
                message: 'Our servers are experiencing issues. Please try again in a few minutes.',
                suggestions: ['Wait a few minutes and try again', 'Contact support if the problem persists']
            }
        };

        const errorInfo = errorMessages[errorData.type] || errorMessages['server_error'];
        this.showErrorModal({
            ...errorInfo,
            originalError: errorData
        });

        // Clear pending donation on error
        this.clearPendingDonation();
    }

    /**
     * Show success modal
     * @param {Object} donationData - Donation details
     */
    showSuccessModal(donationData) {
        const modal = this.createModal('success');
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-md mx-auto shadow-2xl">
                <div class="text-center">
                    <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                        <span class="material-symbols-outlined text-green-600 dark:text-green-400 text-3xl">check_circle</span>
                    </div>
                    
                    <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        Thank You for Your Donation!
                    </h2>
                    
                    <p class="text-gray-600 dark:text-gray-300 mb-6">
                        Your generous donation of <span class="font-semibold text-primary">${donationData.amount}</span> 
                        will help plant approximately <span class="font-semibold text-primary">${donationData.trees} trees</span>.
                    </p>
                    
                    <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-6">
                        <h3 class="font-semibold text-green-800 dark:text-green-200 mb-2">What happens next?</h3>
                        <ul class="text-sm text-green-700 dark:text-green-300 space-y-1 text-left">
                            <li>• You'll receive a confirmation email shortly</li>
                            <li>• Your trees will be planted within 30 days</li>
                            <li>• You'll get updates on your environmental impact</li>
                        </ul>
                    </div>
                    
                    <div class="flex gap-3">
                        <button onclick="donationHandler.closeModal()" 
                                class="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                            Close
                        </button>
                        <button onclick="donationHandler.shareSuccess()" 
                                class="flex-1 bg-primary text-gray-900 px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
                            Share Impact
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.showModal(modal);
    }

    /**
     * Show error modal with suggestions
     * @param {Object} errorInfo - Error information and suggestions
     */
    showErrorModal(errorInfo) {
        const modal = this.createModal('error');
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-md mx-auto shadow-2xl">
                <div class="text-center">
                    <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                        <span class="material-symbols-outlined text-red-600 dark:text-red-400 text-3xl">error</span>
                    </div>
                    
                    <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        ${errorInfo.title}
                    </h2>
                    
                    <p class="text-gray-600 dark:text-gray-300 mb-6">
                        ${errorInfo.message}
                    </p>
                    
                    ${errorInfo.suggestions ? `
                        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
                            <h3 class="font-semibold text-blue-800 dark:text-blue-200 mb-2">Try these solutions:</h3>
                            <ul class="text-sm text-blue-700 dark:text-blue-300 space-y-1 text-left">
                                ${errorInfo.suggestions.map(suggestion => `<li>• ${suggestion}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    <div class="flex gap-3">
                        <button onclick="donationHandler.closeModal()" 
                                class="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                            Close
                        </button>
                        <button onclick="donationHandler.retryDonation()" 
                                class="flex-1 bg-primary text-gray-900 px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.showModal(modal);
    }

    /**
     * Create modal element
     * @param {string} type - Modal type (success/error)
     * @returns {HTMLElement} Modal element
     */
    createModal(type) {
        const modal = document.createElement('div');
        modal.id = `donation-modal-${type}`;
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', `modal-title-${type}`);
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById(`donation-modal-${type}`)) {
                this.closeModal();
            }
        });
        
        return modal;
    }

    /**
     * Show modal
     * @param {HTMLElement} modal - Modal element to show
     */
    showModal(modal) {
        // Remove any existing modals
        this.closeModal();
        
        document.body.appendChild(modal);
        
        // Focus management for accessibility
        const firstButton = modal.querySelector('button');
        if (firstButton) {
            firstButton.focus();
        }
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close modal
     */
    closeModal() {
        const modals = document.querySelectorAll('[id^="donation-modal-"]');
        modals.forEach(modal => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        });
        
        // Restore body scroll
        document.body.style.overflow = '';
    }

    /**
     * Show processing notification
     */
    showProcessingNotification() {
        this.showNotification({
            type: 'info',
            title: 'Processing Donation',
            message: 'Redirecting to PayPal...',
            duration: 3000,
            icon: 'hourglass_empty'
        });
    }

    /**
     * Show notification
     * @param {Object} options - Notification options
     */
    showNotification(options) {
        const notification = document.createElement('div');
        notification.className = `notification bg-white dark:bg-gray-800 border-l-4 ${this.getNotificationColors(options.type)} rounded-lg shadow-lg p-4 max-w-sm transform transition-all duration-300 translate-x-full`;
        
        notification.innerHTML = `
            <div class="flex items-start gap-3">
                <span class="material-symbols-outlined ${this.getIconColor(options.type)} text-xl flex-shrink-0 mt-0.5">
                    ${options.icon || this.getDefaultIcon(options.type)}
                </span>
                <div class="flex-1 min-w-0">
                    <h4 class="font-semibold text-gray-900 dark:text-white text-sm">${options.title}</h4>
                    <p class="text-gray-600 dark:text-gray-300 text-sm mt-1">${options.message}</p>
                </div>
                <button onclick="this.parentNode.parentNode.remove()" 
                        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0">
                    <span class="material-symbols-outlined text-lg">close</span>
                </button>
            </div>
        `;
        
        this.notificationContainer.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 10);
        
        // Auto-remove
        if (options.duration) {
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.classList.add('translate-x-full');
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                    }, 300);
                }
            }, options.duration);
        }
    }

    /**
     * Get notification colors based on type
     * @param {string} type - Notification type
     * @returns {string} CSS classes for colors
     */
    getNotificationColors(type) {
        const colors = {
            success: 'border-green-500',
            error: 'border-red-500',
            warning: 'border-yellow-500',
            info: 'border-blue-500'
        };
        return colors[type] || colors.info;
    }

    /**
     * Get icon color based on type
     * @param {string} type - Notification type
     * @returns {string} CSS classes for icon color
     */
    getIconColor(type) {
        const colors = {
            success: 'text-green-600 dark:text-green-400',
            error: 'text-red-600 dark:text-red-400',
            warning: 'text-yellow-600 dark:text-yellow-400',
            info: 'text-blue-600 dark:text-blue-400'
        };
        return colors[type] || colors.info;
    }

    /**
     * Get default icon based on type
     * @param {string} type - Notification type
     * @returns {string} Material icon name
     */
    getDefaultIcon(type) {
        const icons = {
            success: 'check_circle',
            error: 'error',
            warning: 'warning',
            info: 'info'
        };
        return icons[type] || icons.info;
    }

    /**
     * Clear all notifications
     */
    clearNotifications() {
        if (this.notificationContainer) {
            this.notificationContainer.innerHTML = '';
        }
    }

    /**
     * Show error notification
     * @param {Object} error - Error details
     */
    showError(error) {
        this.showNotification({
            type: 'error',
            title: error.title || 'Error',
            message: error.message || 'An unexpected error occurred.',
            duration: 8000
        });
    }

    /**
     * Handle URL parameters for PayPal returns
     */
    handleUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        
        if (urlParams.get('success') === '1') {
            // Handle successful donation return from PayPal
            const pendingDonation = this.getPendingDonation();
            if (pendingDonation) {
                this.handleDonationSuccess({
                    paypal_return: true,
                    transaction_id: urlParams.get('tx') || null,
                    payer_id: urlParams.get('payer_id') || null
                });
            }
        } else if (urlParams.get('cancelled') === '1') {
            // Handle cancelled donation
            this.handleDonationCancellation();
        }
    }

    /**
     * Handle donation cancellation
     */
    handleDonationCancellation() {
        this.clearPendingDonation();
        this.showNotification({
            type: 'warning',
            title: 'Donation Cancelled',
            message: 'Your donation was cancelled. You can try again anytime.',
            duration: 5000
        });
    }

    /**
     * Get pending donation from localStorage
     * @returns {Object|null} Pending donation data
     */
    getPendingDonation() {
        try {
            const data = localStorage.getItem('pendingDonation');
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.warn('Failed to get pending donation:', error);
            return null;
        }
    }

    /**
     * Clear pending donation from localStorage
     */
    clearPendingDonation() {
        try {
            localStorage.removeItem('pendingDonation');
        } catch (error) {
            console.warn('Failed to clear pending donation:', error);
        }
    }

    /**
     * Update statistics after successful donation
     * @param {number} amount - Donation amount
     */
    async updateStatistics(amount) {
        try {
            if (window.statisticsEngine && typeof window.statisticsEngine.incrementStatistics === 'function') {
                await window.statisticsEngine.incrementStatistics(amount);
            }
        } catch (error) {
            console.warn('Failed to update statistics:', error);
        }
    }

    /**
     * Send email notification for donation receipt
     * @param {Object} donationData - Donation details
     */
    async sendEmailNotification(donationData) {
        try {
            const response = await fetch('/api/donations/email-receipt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount: donationData.amount,
                    currency: donationData.currency || 'USD',
                    trees: donationData.trees,
                    timestamp: donationData.timestamp,
                    transactionId: donationData.transaction_id,
                    payerId: donationData.payer_id
                })
            });

            if (!response.ok) {
                throw new Error(`Email service responded with status: ${response.status}`);
            }

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Email sending failed');
            }

            console.log('Email notification sent successfully');
        } catch (error) {
            console.warn('Failed to send email notification:', error);
            // Don't show error to user as donation was successful
        }
    }

    /**
     * Track donation success for analytics
     * @param {Object} donationData - Donation details
     */
    trackDonationSuccess(donationData) {
        try {
            // Track in analytics if available
            if (typeof gtag !== 'undefined') {
                gtag('event', 'donation_completed', {
                    value: donationData.amount,
                    currency: donationData.currency || 'USD',
                    transaction_id: donationData.transaction_id
                });
            }
            
            console.log('Donation success tracked:', donationData);
        } catch (error) {
            
        }
    }

    /**
     * Share success on social media
     */
    shareSuccess() {
        const pendingDonation = this.getPendingDonation();
        const trees = pendingDonation?.trees || 0;
        
        const shareText = `I just donated to plant ${trees} trees with Give Green, Live Clean! 🌱 Join me in making a difference for our planet. #GiveGreenLiveClean #Reforestation`;
        const shareUrl = window.location.origin;
        
        if (navigator.share) {
            navigator.share({
                title: 'I made a difference!',
                text: shareText,
                url: shareUrl
            }).catch(console.warn);
        } else {
            // Fallback to Twitter share
            const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
            window.open(twitterUrl, '_blank', 'width=550,height=420');
        }
        
        this.closeModal();
    }

    /**
     * Retry donation after error
     */
    retryDonation() {
        this.closeModal();
        
        // Navigate to donate tab if not already there
        if (window.tabNavigation) {
            window.tabNavigation.showTab('donate');
        }
        
        // Focus on donation form
        setTimeout(() => {
            const donateTab = document.getElementById('tab-donate');
            if (donateTab) {
                donateTab.scrollIntoView({ behavior: 'smooth' });
            }
        }, 300);
    }
}

// Initialize donation handler when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.donationHandler = new DonationHandler();
});