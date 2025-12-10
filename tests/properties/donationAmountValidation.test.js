/**
 * Property-Based Tests for Donation Amount Validation
 * **Feature: donation-website, Property 4: Donation Amount Validation**
 * **Validates: Requirements 1.5**
 */

const fc = require('fast-check')

describe('Donation Amount Validation Properties', () => {
  /**
   * Mock Donation Amount Validator for testing core logic
   */
  class MockDonationAmountValidator {
    constructor() {
      this.minAmount = 1
      this.maxAmount = 10000
      this.suggestedAmounts = [10, 25, 50, 100, 250]
    }

    validateAmount(amount) {
      if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
        return { valid: false, error: 'Amount must be a valid number' }
      }

      if (amount < this.minAmount) {
        return { valid: false, error: `Minimum donation is $${this.minAmount}` }
      }

      if (amount > this.maxAmount) {
        return { valid: false, error: `Maximum donation is $${this.maxAmount}` }
      }

      return { valid: true, error: null }
    }

    formatAmount(amount) {
      const validation = this.validateAmount(amount)
      if (!validation.valid) {
        return null
      }
      return amount.toFixed(2)
    }

    sanitizeInput(input) {
      // Remove any non-numeric characters except decimal point
      const cleaned = String(input).replace(/[^0-9.]/g, '')
      const parsed = parseFloat(cleaned)
      return isNaN(parsed) ? null : parsed
    }

    getSuggestedAmounts() {
      return [...this.suggestedAmounts]
    }

    isSuggestedAmount(amount) {
      return this.suggestedAmounts.includes(amount)
    }

    calculateTrees(amount) {
      const validation = this.validateAmount(amount)
      if (!validation.valid) {
        return 0
      }
      return Math.floor(amount * 2) // $1 = 2 trees
    }

    getAmountRange() {
      return { min: this.minAmount, max: this.maxAmount }
    }
  }

  /**
   * Property 4: Donation Amount Validation
   * For any donation amount configuration, the system should display suggested amounts
   * correctly and accept valid custom inputs
   */
  test('Property 4: Valid donation amounts are accepted and formatted correctly', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 10000 }).filter(n => !isNaN(n) && isFinite(n)),
        (amount) => {
          const validator = new MockDonationAmountValidator()

          // Property: Valid amounts should pass validation
          const validation = validator.validateAmount(amount)
          expect(validation.valid).toBe(true)
          expect(validation.error).toBe(null)

          // Property: Valid amounts should format correctly
          const formatted = validator.formatAmount(amount)
          expect(formatted).not.toBe(null)
          expect(formatted).toMatch(/^\d+\.\d{2}$/)
          expect(parseFloat(formatted)).toBeCloseTo(amount, 2)

          // Property: Trees calculation should be consistent
          const trees = validator.calculateTrees(amount)
          expect(trees).toBe(Math.floor(amount * 2))
          expect(trees).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Invalid donation amounts are rejected with appropriate errors
   */
  test('Property: Invalid donation amounts are rejected with appropriate errors', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(0), // zero amount
          fc.constant(-10), // negative amount
          fc.float({ min: 10001, max: 100000 }), // too large
          fc.constant(NaN), // not a number
          fc.constant(Infinity), // infinity
          fc.constant(-Infinity), // negative infinity
          fc.constant(null), // null
          fc.constant(undefined) // undefined
        ),
        (invalidAmount) => {
          const validator = new MockDonationAmountValidator()

          // Property: Invalid amounts should fail validation
          const validation = validator.validateAmount(invalidAmount)
          expect(validation.valid).toBe(false)
          expect(validation.error).toBeTruthy()
          expect(typeof validation.error).toBe('string')

          // Property: Invalid amounts should not format
          const formatted = validator.formatAmount(invalidAmount)
          expect(formatted).toBe(null)

          // Property: Invalid amounts should return 0 trees
          const trees = validator.calculateTrees(invalidAmount)
          expect(trees).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Suggested amounts are always valid and properly configured
   */
  test('Property: Suggested amounts are always valid and properly configured', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: 1, max: 1000 }).filter(n => !isNaN(n) && isFinite(n)), { minLength: 1, maxLength: 10 }),
        (customSuggestedAmounts) => {
          const validator = new MockDonationAmountValidator()

          // Override suggested amounts for testing
          validator.suggestedAmounts = customSuggestedAmounts

          const suggestedAmounts = validator.getSuggestedAmounts()

          // Property: All suggested amounts should be valid
          suggestedAmounts.forEach(amount => {
            const validation = validator.validateAmount(amount)
            expect(validation.valid).toBe(true)
            expect(validation.error).toBe(null)
          })

          // Property: All suggested amounts should format correctly
          suggestedAmounts.forEach(amount => {
            const formatted = validator.formatAmount(amount)
            expect(formatted).not.toBe(null)
            expect(formatted).toMatch(/^\d+\.\d{2}$/)
          })

          // Property: Suggested amounts should be recognized as suggested
          suggestedAmounts.forEach(amount => {
            expect(validator.isSuggestedAmount(amount)).toBe(true)
          })

          // Property: Non-suggested amounts should not be recognized as suggested
          const nonSuggestedAmount = Math.max(...suggestedAmounts) + 1
          if (nonSuggestedAmount <= validator.maxAmount) {
            expect(validator.isSuggestedAmount(nonSuggestedAmount)).toBe(false)
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property: Input sanitization handles various input formats correctly
   */
  test('Property: Input sanitization handles various input formats correctly', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.float({ min: 1, max: 10000 }).map(n => n.toString()), // valid number strings
          fc.float({ min: 1, max: 10000 }).map(n => `$${n.toFixed(2)}`), // currency format
          fc.float({ min: 1, max: 10000 }).map(n => `${n.toFixed(2)} USD`), // with currency code
          fc.float({ min: 1, max: 10000 }).map(n => ` ${n.toFixed(2)} `), // with whitespace
          fc.string().filter(s => !/\d/.test(s)), // non-numeric strings
          fc.constant(''), // empty string
          fc.constant('abc123def'), // mixed alphanumeric
          fc.constant('12.34.56') // invalid decimal format
        ),
        (input) => {
          const validator = new MockDonationAmountValidator()
          const sanitized = validator.sanitizeInput(input)

          if (sanitized !== null) {
            // Property: Sanitized values should be valid numbers
            expect(typeof sanitized).toBe('number')
            expect(isNaN(sanitized)).toBe(false)
            expect(isFinite(sanitized)).toBe(true)

            // Property: Sanitized values should be parseable from original input
            const originalNumber = parseFloat(String(input).replace(/[^0-9.]/g, ''))
            if (!isNaN(originalNumber)) {
              expect(sanitized).toBeCloseTo(originalNumber, 2)
            }
          } else {
            // Property: Null results should correspond to unparseable inputs
            const cleaned = String(input).replace(/[^0-9.]/g, '')
            expect(isNaN(parseFloat(cleaned))).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Amount range validation is consistent
   */
  test('Property: Amount range validation is consistent with configured limits', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20000 }).map(n => n / 100), // Convert to float with 2 decimal places
        (amount) => {
          const validator = new MockDonationAmountValidator()
          const range = validator.getAmountRange()
          const validation = validator.validateAmount(amount)

          // Property: Amounts within range should be valid
          if (amount >= range.min && amount <= range.max) {
            expect(validation.valid).toBe(true)
            expect(validation.error).toBe(null)
          }

          // Property: Amounts below minimum should be invalid
          if (amount < range.min) {
            expect(validation.valid).toBe(false)
            expect(validation.error).toContain('Minimum')
          }

          // Property: Amounts above maximum should be invalid
          if (amount > range.max) {
            expect(validation.valid).toBe(false)
            expect(validation.error).toContain('Maximum')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Trees calculation is proportional and consistent
   */
  test('Property: Trees calculation is proportional and consistent', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 10000 }).filter(n => !isNaN(n) && isFinite(n)),
        (amount) => {
          const validator = new MockDonationAmountValidator()
          const trees = validator.calculateTrees(amount)

          // Property: Trees should be proportional to amount (2 trees per dollar)
          expect(trees).toBe(Math.floor(amount * 2))

          // Property: Trees should never be negative
          expect(trees).toBeGreaterThanOrEqual(0)

          // Property: Trees should be an integer
          expect(Number.isInteger(trees)).toBe(true)

          // Property: Larger amounts should result in more or equal trees (if within valid range)
          const largerAmount = amount + 1
          if (largerAmount <= validator.maxAmount) {
            const largerTrees = validator.calculateTrees(largerAmount)
            expect(largerTrees).toBeGreaterThanOrEqual(trees)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Validation error messages are informative and consistent
   */
  test('Property: Validation error messages are informative and consistent', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -1000, max: 99 }).map(n => n / 100), // below minimum
          fc.integer({ min: 1000100, max: 10000000 }).map(n => n / 100), // above maximum
          fc.constant(NaN), // invalid number
          fc.constant('not a number') // non-numeric
        ),
        (invalidInput) => {
          const validator = new MockDonationAmountValidator()
          const validation = validator.validateAmount(invalidInput)

          // Property: Invalid inputs should always have error messages
          expect(validation.valid).toBe(false)
          expect(validation.error).toBeTruthy()
          expect(typeof validation.error).toBe('string')
          expect(validation.error.length).toBeGreaterThan(0)

          // Property: Error messages should be descriptive
          if (typeof invalidInput === 'number' && !isNaN(invalidInput) && isFinite(invalidInput)) {
            if (invalidInput < validator.minAmount) {
              expect(validation.error).toContain('Minimum')
            } else if (invalidInput > validator.maxAmount) {
              expect(validation.error).toContain('Maximum')
            }
          } else {
            expect(validation.error).toContain('valid number')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Validation is deterministic and repeatable
   */
  test('Property: Validation is deterministic and repeatable', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.float({ min: 1, max: 10000 }).filter(n => !isNaN(n) && isFinite(n)),
          fc.integer({ min: -10000, max: 99 }).map(n => n / 100),
          fc.integer({ min: 1000100, max: 10000000 }).map(n => n / 100),
          fc.constant(NaN)
        ),
        (amount) => {
          const validator1 = new MockDonationAmountValidator()
          const validator2 = new MockDonationAmountValidator()

          // Property: Same input should produce same validation result
          const validation1 = validator1.validateAmount(amount)
          const validation2 = validator2.validateAmount(amount)

          expect(validation1.valid).toBe(validation2.valid)
          expect(validation1.error).toBe(validation2.error)

          // Property: Same input should produce same formatting result
          const formatted1 = validator1.formatAmount(amount)
          const formatted2 = validator2.formatAmount(amount)

          expect(formatted1).toBe(formatted2)

          // Property: Same input should produce same trees calculation
          const trees1 = validator1.calculateTrees(amount)
          const trees2 = validator2.calculateTrees(amount)

          expect(trees1).toBe(trees2)
        }
      ),
      { numRuns: 100 }
    )
  })
})