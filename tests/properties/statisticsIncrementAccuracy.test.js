const fc = require('fast-check')
const StatisticsEngine = require('../utils/StatisticsEngineNode')

/**
 * **Feature: donation-website, Property 7: Statistics Increment Accuracy**
 * **Validates: Requirements 2.5**
 *
 * For any completed donation, the system should increment relevant statistics
 * counters by amounts proportional to the donation value
 */

describe('Property-Based Tests: Statistics Increment Accuracy', () => {
  let mockFetch

  beforeEach(() => {
    // Mock fetch globally
    mockFetch = jest.fn()
    global.fetch = mockFetch
  })

  afterEach(() => {
    if (mockFetch) {
      mockFetch.mockRestore()
    }
    delete global.fetch
  })

  /**
   * Property 7: Statistics Increment Accuracy
   * For any completed donation, the system should increment relevant statistics
   * counters by amounts proportional to the donation value
   */
  test('Property 7: Statistics increments are proportional to donation amounts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }), // Donation amount as integer to avoid float issues
        async (donationAmount) => {
          // Mock successful increment response
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                statistics: {
                  trees_planted: { value: 1000 + Math.floor(donationAmount * 2), format: 'number_with_suffix' },
                  hectares_restored: { value: 50 + Math.floor((donationAmount / 100) * 0.1 * 100) / 100, format: 'number_with_plus' },
                  global_impact: { value: 'Worldwide', format: 'text' }
                },
                last_updated: new Date().toISOString()
              },
              donation_amount: donationAmount,
              increments_applied: {
                trees_planted: Math.floor(donationAmount * 2),
                hectares_restored: Math.floor((donationAmount / 100) * 0.1 * 100) / 100
              },
              timestamp: new Date().toISOString()
            })
          })

          const engine = new StatisticsEngine({
            apiEndpoint: '/api/statistics',
            retryAttempts: 1
          })

          // Test increment calculation
          const expectedIncrements = engine.calculateStatisticsIncrements(donationAmount)

          // Verify increment calculations are correct
          const expectedTrees = Math.floor(donationAmount * 2) // 2 trees per dollar
          const expectedHectares = Math.floor((donationAmount / 100) * 0.1 * 100) / 100 // 0.1 hectares per $100

          expect(expectedIncrements.trees_planted).toBe(expectedTrees)
          expect(expectedIncrements.hectares_restored).toBe(expectedHectares)
          expect(expectedIncrements.global_impact).toBeNull() // Text field doesn't increment

          // Test actual increment functionality
          const result = await engine.incrementStatistics(donationAmount)

          // Verify API was called with correct data
          expect(mockFetch).toHaveBeenCalledWith('/api/statistics/increment', {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              donation_amount: donationAmount,
              increments: expectedIncrements
            })
          })

          // Verify result contains updated statistics
          expect(result).toBeDefined()
          expect(result.statistics).toBeDefined()
          expect(result.statistics.trees_planted.value).toBeGreaterThanOrEqual(expectedTrees)
          expect(result.statistics.hectares_restored.value).toBeGreaterThanOrEqual(expectedHectares)

          // Cleanup
          engine.destroy()
        }
      ),
      { numRuns: 50 } // Reduced runs for performance
    )
  })

  /**
   * Property: Increment calculations are consistent and deterministic
   * For any donation amount, the same amount should always produce the same increments
   */
  test('Property: Increment calculations are deterministic', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }).filter(x => !isNaN(x) && isFinite(x)),
        async (donationAmount) => {
          const engine = new StatisticsEngine()

          // Calculate increments multiple times
          const increments1 = engine.calculateStatisticsIncrements(donationAmount)
          const increments2 = engine.calculateStatisticsIncrements(donationAmount)
          const increments3 = engine.calculateStatisticsIncrements(donationAmount)

          // All calculations should be identical
          expect(increments1).toEqual(increments2)
          expect(increments2).toEqual(increments3)

          // Verify increment values are non-negative
          expect(increments1.trees_planted).toBeGreaterThanOrEqual(0)
          expect(increments1.hectares_restored).toBeGreaterThanOrEqual(0)

          // Verify increments scale with donation amount
          if (donationAmount >= 1) {
            expect(increments1.trees_planted).toBeGreaterThan(0)
          }
          if (donationAmount >= 100) {
            expect(increments1.hectares_restored).toBeGreaterThan(0)
          }

          engine.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: PayPal data extraction handles various data formats
   * For any valid PayPal transaction data, the system should extract the correct amount
   */
  test('Property: PayPal data extraction is robust across formats', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          amount: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }).filter(x => !isNaN(x) && isFinite(x) && x > 0),
          format: fc.constantFrom('purchase_units', 'amount', 'value')
        }),
        async ({ amount, format }) => {
          const engine = new StatisticsEngine()

          // Create PayPal data in different formats
          let paypalData
          switch (format) {
            case 'purchase_units':
              paypalData = {
                purchase_units: [{
                  amount: { value: amount.toString() }
                }],
                transactionID: 'test-transaction-123'
              }
              break
            case 'amount':
              paypalData = {
                amount,
                orderID: 'test-order-456'
              }
              break
            case 'value':
              paypalData = {
                value: amount,
                transactionID: 'test-transaction-789'
              }
              break
          }

          // Extract amount
          const extractedAmount = engine.extractDonationAmount(paypalData)

          // Verify extraction is accurate (within floating point precision)
          expect(Math.abs(extractedAmount - amount)).toBeLessThan(0.01)
          expect(extractedAmount).toBeGreaterThan(0)

          engine.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Invalid donation amounts are handled gracefully
   * For any invalid donation amount, the system should handle it without crashing
   */
  test('Property: Invalid donation amounts are handled gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(0),
          fc.constant(-1),
          fc.constant(null),
          fc.constant(undefined),
          fc.constant('invalid'),
          fc.constant(NaN),
          fc.constant(Infinity)
        ),
        async (invalidAmount) => {
          const engine = new StatisticsEngine()

          // Test increment calculation with invalid amount
          let calculationResult
          expect(() => {
            calculationResult = engine.calculateStatisticsIncrements(invalidAmount)
          }).not.toThrow()

          // Should return valid structure even for invalid input
          expect(calculationResult).toBeDefined()
          expect(typeof calculationResult).toBe('object')
          expect(calculationResult).toHaveProperty('trees_planted')
          expect(calculationResult).toHaveProperty('hectares_restored')
          expect(calculationResult).toHaveProperty('global_impact')

          // Test increment statistics with invalid amount
          let incrementResult
          try {
            incrementResult = await engine.incrementStatistics(invalidAmount)
          } catch (error) {
            // Should either return gracefully or throw a proper error
            expect(error).toBeInstanceOf(Error)
          }

          // If it returns, should be undefined (early return for invalid amounts)
          if (incrementResult !== undefined) {
            expect(incrementResult).toBeUndefined()
          }

          engine.destroy()
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property: Conversion rates are applied correctly
   * For any donation amount, verify the conversion rates are mathematically correct
   */
  test('Property: Conversion rates produce mathematically correct results', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: Math.fround(0.01), max: Math.fround(5000) }).filter(x => !isNaN(x) && isFinite(x) && x > 0),
        async (donationAmount) => {
          const engine = new StatisticsEngine()
          const increments = engine.calculateStatisticsIncrements(donationAmount)

          // Verify conversion rates
          const TREES_PER_DOLLAR = 2
          const HECTARES_PER_HUNDRED_DOLLARS = 0.1

          const expectedTrees = Math.floor(donationAmount * TREES_PER_DOLLAR)
          const expectedHectares = Math.floor((donationAmount / 100) * HECTARES_PER_HUNDRED_DOLLARS * 100) / 100

          expect(increments.trees_planted).toBe(expectedTrees)
          expect(increments.hectares_restored).toBe(expectedHectares)

          // Verify mathematical relationships
          expect(increments.trees_planted).toBeLessThanOrEqual(donationAmount * TREES_PER_DOLLAR)
          expect(increments.hectares_restored).toBeLessThanOrEqual((donationAmount / 100) * HECTARES_PER_HUNDRED_DOLLARS)

          // Verify increments are proportional to donation amount
          if (donationAmount >= 1) {
            expect(increments.trees_planted / donationAmount).toBeLessThanOrEqual(TREES_PER_DOLLAR)
            expect(increments.trees_planted / donationAmount).toBeGreaterThan(TREES_PER_DOLLAR - 1) // Account for floor rounding
          }

          engine.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })
})
