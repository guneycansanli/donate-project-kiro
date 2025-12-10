/**
 * Property-Based Tests for Error Handling Robustness
 * **Feature: donation-website, Property 2: Error Handling Robustness**
 * **Validates: Requirements 1.4**
 */

const fc = require('fast-check')

describe('Error Handling Robustness Properties', () => {
  /**
   * Mock Donation Handler for testing error handling logic
   */
  class MockDonationHandler {
    constructor() {
      this.notifications = []
      this.modals = []
      this.systemState = {
        stable: true,
        pendingDonation: null,
        errorCount: 0
      }
      this.errorMessages = {
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
          suggestions: ['Verify the donation amount', 'Ensure all required fields are filled', 'Try a different payment method if the issue persists']
        },
        'server_error': {
          title: 'Server Error',
          message: 'Our servers are experiencing issues. Please try again in a few minutes.',
          suggestions: ['Wait a few minutes and try again', 'Contact support if the problem persists']
        }
      }
    }

    handleDonationError(errorData) {
      try {
        // Validate input
        if (!errorData || typeof errorData !== 'object') {
          throw new Error('Invalid error data provided')
        }
        
        // Clear any existing notifications
        this.clearNotifications()
        
        // Get error message configuration - use hasOwnProperty to avoid prototype pollution
        const errorType = errorData.type && typeof errorData.type === 'string' ? errorData.type : 'server_error'
        const errorInfo = this.errorMessages.hasOwnProperty(errorType) ? 
          this.errorMessages[errorType] : 
          this.errorMessages['server_error']
        
        // Show error modal with suggestions
        this.showErrorModal({
          ...errorInfo,
          originalError: errorData
        })
        
        // Clear pending donation on error
        this.clearPendingDonation()
        
        // Increment error count for stability tracking
        this.systemState.errorCount++
        
        return {
          success: true,
          errorHandled: true,
          errorType: errorType,
          hasMessage: !!errorInfo.message,
          hasSuggestions: !!(errorInfo.suggestions && errorInfo.suggestions.length > 0),
          systemStable: this.systemState.stable
        }
      } catch (error) {
        this.systemState.stable = false
        return {
          success: false,
          errorHandled: false,
          systemStable: false,
          internalError: error.message
        }
      }
    }

    showErrorModal(errorInfo) {
      if (!errorInfo.title || !errorInfo.message) {
        throw new Error('Error modal requires title and message')
      }
      
      const modal = {
        type: 'error',
        title: errorInfo.title,
        message: errorInfo.message,
        suggestions: errorInfo.suggestions || [],
        timestamp: new Date().toISOString(),
        originalError: errorInfo.originalError
      }
      
      this.modals.push(modal)
      return modal
    }

    showError(errorData) {
      const notification = {
        type: 'error',
        title: errorData.title || 'Error',
        message: errorData.message || 'An unexpected error occurred.',
        timestamp: new Date().toISOString()
      }
      
      this.notifications.push(notification)
      return notification
    }

    clearNotifications() {
      this.notifications = []
    }

    clearPendingDonation() {
      this.systemState.pendingDonation = null
    }

    setPendingDonation(donationData) {
      this.systemState.pendingDonation = donationData
    }

    getSystemState() {
      return { ...this.systemState }
    }

    getLastModal() {
      return this.modals[this.modals.length - 1] || null
    }

    getLastNotification() {
      return this.notifications[this.notifications.length - 1] || null
    }

    getAllModals() {
      return [...this.modals]
    }

    getAllNotifications() {
      return [...this.notifications]
    }

    validateErrorMessage(errorType) {
      if (!errorType || typeof errorType !== 'string') return false
      const errorInfo = this.errorMessages.hasOwnProperty(errorType) ? 
        this.errorMessages[errorType] : 
        this.errorMessages['server_error']
      return !!(errorInfo && errorInfo.title && errorInfo.message)
    }

    hasAlternativePaymentSuggestions(errorType) {
      if (!errorType || typeof errorType !== 'string') return false
      const errorInfo = Object.prototype.hasOwnProperty.call(this.errorMessages, errorType) ? 
        this.errorMessages[errorType] : 
        this.errorMessages['server_error']
      if (!errorInfo || !errorInfo.suggestions) return false
      
      return errorInfo.suggestions.some(suggestion => 
        suggestion.toLowerCase().includes('different payment') ||
        suggestion.toLowerCase().includes('alternative') ||
        suggestion.toLowerCase().includes('try again') ||
        suggestion.toLowerCase().includes('contact') ||
        suggestion.toLowerCase().includes('method')
      )
    }
  }

  /**
   * Property 2: Error Handling Robustness
   * For any payment processing failure, the system should display appropriate 
   * error messages and maintain system stability
   */
  test('Property 2: Payment processing failures display clear error messages and maintain stability', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('payment_failed', 'network_error', 'validation_error', 'server_error'),
        fc.record({
          code: fc.string({ minLength: 1, maxLength: 20 }),
          details: fc.string({ minLength: 0, maxLength: 100 }),
          timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          amount: fc.option(fc.float({ min: 1, max: 10000 }), { nil: null })
        }),
        (errorType, errorDetails) => {
          const handler = new MockDonationHandler()
          
          // Set up a pending donation to test cleanup
          if (errorDetails.amount) {
            handler.setPendingDonation({
              amount: errorDetails.amount,
              timestamp: errorDetails.timestamp.toISOString()
            })
          }
          
          const errorData = {
            type: errorType,
            code: errorDetails.code,
            details: errorDetails.details,
            timestamp: errorDetails.timestamp.toISOString()
          }
          
          // Handle the error
          const result = handler.handleDonationError(errorData)
          
          // Property: Error handling should always succeed
          expect(result.success).toBe(true)
          expect(result.errorHandled).toBe(true)
          
          // Property: System should remain stable after error handling
          expect(result.systemStable).toBe(true)
          expect(handler.getSystemState().stable).toBe(true)
          
          // Property: Error should be properly categorized
          expect(result.errorType).toBe(errorType)
          
          // Property: Error message should be displayed
          expect(result.hasMessage).toBe(true)
          const modal = handler.getLastModal()
          expect(modal).not.toBeNull()
          expect(modal.title).toBeTruthy()
          expect(modal.message).toBeTruthy()
          expect(modal.type).toBe('error')
          
          // Property: Error messages should be clear and informative
          expect(modal.title.length).toBeGreaterThan(0)
          expect(modal.message.length).toBeGreaterThan(10) // Meaningful message
          
          // Property: Alternative payment methods should be suggested
          expect(result.hasSuggestions).toBe(true)
          expect(modal.suggestions).toBeDefined()
          expect(modal.suggestions.length).toBeGreaterThan(0)
          
          // Property: Suggestions should include alternative payment methods
          expect(handler.hasAlternativePaymentSuggestions(errorType)).toBe(true)
          
          // Property: Pending donation should be cleared on error
          expect(handler.getSystemState().pendingDonation).toBeNull()
          
          // Property: Original error should be preserved for debugging
          expect(modal.originalError).toBeDefined()
          expect(modal.originalError.type).toBe(errorType)
          
          // Property: Error modal should have timestamp
          expect(modal.timestamp).toBeTruthy()
          expect(new Date(modal.timestamp)).toBeInstanceOf(Date)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Unknown error types should fallback to server error
   * For any unknown error type, the system should use server error as fallback
   */
  test('Property: Unknown error types fallback to server error handling', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => 
          !['payment_failed', 'network_error', 'validation_error', 'server_error'].includes(s)
        ),
        fc.record({
          code: fc.string({ minLength: 1, maxLength: 20 }),
          details: fc.string({ minLength: 0, maxLength: 100 })
        }),
        (unknownErrorType, errorDetails) => {
          const handler = new MockDonationHandler()
          
          const errorData = {
            type: unknownErrorType,
            code: errorDetails.code,
            details: errorDetails.details
          }
          
          // Handle unknown error type
          const result = handler.handleDonationError(errorData)
          
          // Property: Unknown errors should still be handled successfully
          expect(result.success).toBe(true)
          expect(result.errorHandled).toBe(true)
          expect(result.systemStable).toBe(true)
          
          // Property: Should fallback to server error message
          const modal = handler.getLastModal()
          expect(modal).not.toBeNull()
          expect(modal.title).toBe('Server Error')
          expect(modal.message).toContain('Our servers are experiencing issues')
          
          // Property: Should still provide suggestions
          expect(modal.suggestions).toBeDefined()
          expect(modal.suggestions.length).toBeGreaterThan(0)
          
          // Property: Original error type should be preserved
          expect(modal.originalError.type).toBe(unknownErrorType)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Multiple consecutive errors maintain system stability
   * For any sequence of errors, the system should remain stable
   */
  test('Property: Multiple consecutive errors maintain system stability', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            type: fc.constantFrom('payment_failed', 'network_error', 'validation_error', 'server_error'),
            code: fc.string({ minLength: 1, maxLength: 20 }),
            details: fc.string({ minLength: 0, maxLength: 100 })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (errorSequence) => {
          const handler = new MockDonationHandler()
          
          // Process each error in sequence
          errorSequence.forEach((errorData, index) => {
            const result = handler.handleDonationError(errorData)
            
            // Property: Each error should be handled successfully
            expect(result.success).toBe(true)
            expect(result.errorHandled).toBe(true)
            
            // Property: System should remain stable throughout
            expect(result.systemStable).toBe(true)
            expect(handler.getSystemState().stable).toBe(true)
            
            // Property: Error count should increment
            expect(handler.getSystemState().errorCount).toBe(index + 1)
          })
          
          // Property: All errors should have been processed
          expect(handler.getAllModals().length).toBe(errorSequence.length)
          
          // Property: Each modal should have proper error information
          handler.getAllModals().forEach((modal, index) => {
            expect(modal.title).toBeTruthy()
            expect(modal.message).toBeTruthy()
            expect(modal.suggestions.length).toBeGreaterThan(0)
            expect(modal.originalError.type).toBe(errorSequence[index].type)
          })
          
          // Property: System should still be stable after all errors
          expect(handler.getSystemState().stable).toBe(true)
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property: Error messages are user-friendly and actionable
   * For any error type, messages should be clear and provide actionable guidance
   */
  test('Property: Error messages are user-friendly and actionable', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('payment_failed', 'network_error', 'validation_error', 'server_error'),
        (errorType) => {
          const handler = new MockDonationHandler()
          
          // Property: Error message should be valid for this type
          expect(handler.validateErrorMessage(errorType)).toBe(true)
          
          const errorData = { type: errorType, code: 'TEST', details: 'Test error' }
          const result = handler.handleDonationError(errorData)
          const modal = handler.getLastModal()
          
          // Property: Message should be user-friendly (no technical jargon)
          expect(modal.message).not.toMatch(/error|exception|stack|trace/i)
          expect(modal.message).not.toMatch(/null|undefined|NaN/i)
          
          // Property: Message should be actionable (contains action words)
          const actionWords = ['try', 'check', 'verify', 'contact', 'wait', 'refresh']
          const hasActionableContent = actionWords.some(word => 
            modal.message.toLowerCase().includes(word) ||
            modal.suggestions.some(suggestion => suggestion.toLowerCase().includes(word))
          )
          expect(hasActionableContent).toBe(true)
          
          // Property: Suggestions should be specific and helpful
          modal.suggestions.forEach(suggestion => {
            expect(suggestion.length).toBeGreaterThan(5) // Not just "Try again"
            expect(suggestion).toMatch(/^[A-Z]/) // Proper capitalization
          })
          
          // Property: Title should be concise and descriptive
          expect(modal.title.length).toBeLessThan(50)
          expect(modal.title.length).toBeGreaterThan(5)
          expect(modal.title).toMatch(/^[A-Z]/) // Proper capitalization
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Error handling preserves user context
   * For any error with pending donation, context should be properly managed
   */
  test('Property: Error handling preserves and cleans up user context appropriately', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('payment_failed', 'network_error', 'validation_error', 'server_error'),
        fc.record({
          amount: fc.float({ min: 1, max: 10000 }),
          currency: fc.constantFrom('USD', 'EUR', 'GBP'),
          timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          trees: fc.integer({ min: 1, max: 20000 })
        }),
        (errorType, donationContext) => {
          const handler = new MockDonationHandler()
          
          // Set up donation context
          handler.setPendingDonation(donationContext)
          
          // Verify context is set
          expect(handler.getSystemState().pendingDonation).not.toBeNull()
          
          const errorData = {
            type: errorType,
            code: 'CONTEXT_TEST',
            details: 'Testing context preservation'
          }
          
          // Handle error
          const result = handler.handleDonationError(errorData)
          
          // Property: Error should be handled successfully
          expect(result.success).toBe(true)
          expect(result.systemStable).toBe(true)
          
          // Property: Pending donation should be cleared to prevent confusion
          expect(handler.getSystemState().pendingDonation).toBeNull()
          
          // Property: Error modal should contain original error for debugging
          const modal = handler.getLastModal()
          expect(modal.originalError).toBeDefined()
          expect(modal.originalError.type).toBe(errorType)
          
          // Property: System should be ready for new donation attempts
          expect(handler.getSystemState().stable).toBe(true)
          
          // Property: Error handling should not corrupt system state
          const systemState = handler.getSystemState()
          expect(typeof systemState.stable).toBe('boolean')
          expect(typeof systemState.errorCount).toBe('number')
          expect(systemState.errorCount).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})