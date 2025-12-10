const fc = require('fast-check')
const StatisticsEngine = require('../utils/StatisticsEngineNode')

/**
 * **Feature: donation-website, Property 5: Statistics Display Consistency**
 * **Validates: Requirements 2.1, 2.3, 2.4**
 * 
 * For any statistics configuration, the system should display all metrics with 
 * proper formatting and handle missing data gracefully
 */

describe('Property-Based Tests: Statistics Display Consistency', () => {
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
   * Property 5: Statistics Display Consistency
   * For any statistics configuration, the system should display all metrics with 
   * proper formatting and handle missing data gracefully
   */
  test('Property 5: Statistics display maintains consistency across all configurations', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid statistics configuration
        fc.record({
          statistics: fc.record({
            trees_planted: fc.record({
              value: fc.oneof(
                fc.integer({ min: 0, max: 1000000 }),
                fc.constant(null),
                fc.constant(undefined)
              ),
              label: fc.oneof(
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.constant(null),
                fc.constant(undefined)
              ),
              icon: fc.oneof(
                fc.constantFrom('park', 'nature', 'eco'),
                fc.constant(null),
                fc.constant(undefined)
              ),
              format: fc.oneof(
                fc.constantFrom('number_with_suffix', 'number_with_plus', 'number_with_separators', 'text'),
                fc.constant(null),
                fc.constant(undefined)
              )
            }),
            hectares_restored: fc.record({
              value: fc.oneof(
                fc.integer({ min: 0, max: 10000 }),
                fc.constant(null),
                fc.constant(undefined)
              ),
              label: fc.oneof(
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.constant(null),
                fc.constant(undefined)
              ),
              icon: fc.oneof(
                fc.constantFrom('landscape', 'terrain', 'map'),
                fc.constant(null),
                fc.constant(undefined)
              ),
              format: fc.oneof(
                fc.constantFrom('number_with_suffix', 'number_with_plus', 'number_with_separators', 'text'),
                fc.constant(null),
                fc.constant(undefined)
              )
            }),
            global_impact: fc.record({
              value: fc.oneof(
                fc.string({ minLength: 1, maxLength: 20 }),
                fc.constant(null),
                fc.constant(undefined)
              ),
              label: fc.oneof(
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.constant(null),
                fc.constant(undefined)
              ),
              icon: fc.oneof(
                fc.constantFrom('public', 'language', 'globe'),
                fc.constant(null),
                fc.constant(undefined)
              ),
              format: fc.oneof(
                fc.constant('text'),
                fc.constant(null),
                fc.constant(undefined)
              )
            })
          }),
          last_updated: fc.oneof(
            fc.date().map(d => d.toISOString()),
            fc.constant(null),
            fc.constant(undefined)
          )
        }),
        async (statisticsData) => {
          // Mock successful API response
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              success: true,
              data: statisticsData,
              timestamp: new Date().toISOString()
            })
          })

          // Create statistics engine instance
          const engine = new StatisticsEngine({
            apiEndpoint: '/api/statistics',
            pollInterval: 30000,
            retryAttempts: 3
          })

          // Fetch statistics data
          await engine.fetchStatistics()

          // Verify the engine has the correct data
          const currentStats = engine.getCurrentStats()
          expect(currentStats).toBeDefined()
          expect(currentStats.statistics).toBeDefined()

          // Test that all required statistics are present
          const statsKeys = ['trees_planted', 'hectares_restored', 'global_impact']
          
          for (const key of statsKeys) {
            const statData = statisticsData.statistics[key]

            // Test value formatting consistency using the engine's formatting method
            if (statData && statData.value !== null && statData.value !== undefined) {
              const formattedValue = engine.formatStatisticValue(statData.value, statData.format)
              
              expect(formattedValue).toBeTruthy()
              expect(typeof formattedValue).toBe('string')
              expect(formattedValue.length).toBeGreaterThan(0)
              
              // Verify formatting is applied correctly based on format type
              if (statData.format === 'number_with_suffix' && typeof statData.value === 'number') {
                if (statData.value >= 1000000000) {
                  expect(formattedValue).toMatch(/\d+(\.\d+)?B/)
                } else if (statData.value >= 1000000) {
                  expect(formattedValue).toMatch(/\d+(\.\d+)?M/)
                } else if (statData.value >= 1000) {
                  expect(formattedValue).toMatch(/\d+(\.\d+)?K/)
                }
              } else if (statData.format === 'number_with_plus' && typeof statData.value === 'number') {
                if (statData.value > 0) {
                  expect(formattedValue).toMatch(/\d+.*\+/)
                }
              } else if (statData.format === 'number_with_separators' && typeof statData.value === 'number') {
                // Should have proper number formatting
                expect(formattedValue).toMatch(/^\d{1,3}(,\d{3})*$/)
              }
            } else {
              // Should handle null/undefined gracefully
              const formattedValue = engine.formatStatisticValue(statData?.value, statData?.format)
              expect(formattedValue).toBeTruthy()
              expect(typeof formattedValue).toBe('string')
            }
          }

          // Test timestamp formatting
          if (statisticsData.last_updated) {
            const formattedTime = engine.formatTimestamp(statisticsData.last_updated)
            expect(formattedTime).toBeTruthy()
            expect(typeof formattedTime).toBe('string')
            expect(formattedTime).not.toBe('unknown')
          }

          // Cleanup
          engine.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Number formatting consistency across different value ranges
   * For any numeric value, formatting should be consistent and readable
   */
  test('Property: Number formatting maintains consistency across value ranges', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          value: fc.integer({ min: 0, max: 1000000000 }),
          format: fc.constantFrom('number_with_suffix', 'number_with_plus', 'number_with_separators')
        }),
        async (testData) => {
          const engine = new StatisticsEngine()
          const formattedValue = engine.formatStatisticValue(testData.value, testData.format)

          // Verify formatting is consistent
          expect(formattedValue).toBeTruthy()
          expect(typeof formattedValue).toBe('string')
          expect(formattedValue.length).toBeGreaterThan(0)

          // Test specific format rules
          switch (testData.format) {
            case 'number_with_suffix':
              if (testData.value >= 1000000000) {
                expect(formattedValue).toMatch(/\d+(\.\d+)?B/)
              } else if (testData.value >= 1000000) {
                expect(formattedValue).toMatch(/\d+(\.\d+)?M/)
              } else if (testData.value >= 1000) {
                expect(formattedValue).toMatch(/\d+(\.\d+)?K/)
              } else {
                expect(formattedValue).toMatch(/^\d{1,3}(,\d{3})*$/)
              }
              break

            case 'number_with_plus':
              if (testData.value > 0) {
                expect(formattedValue).toMatch(/\d+\+?$/)
              }
              break

            case 'number_with_separators':
              expect(formattedValue).toMatch(/^\d{1,3}(,\d{3})*$/)
              break
          }

          // Verify no invalid characters
          expect(formattedValue).not.toMatch(/[^0-9,+.KMB]/)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Error handling maintains display integrity
   * For any error condition, the display should remain functional with fallback values
   */
  test('Property: Error handling preserves display integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Network error
          fc.constant('network_error'),
          // Invalid JSON response
          fc.constant('invalid_json'),
          // API error response
          fc.constant('api_error'),
          // Timeout
          fc.constant('timeout')
        ),
        async (errorType) => {
          // Mock different error conditions
          switch (errorType) {
            case 'network_error':
              mockFetch.mockRejectedValueOnce(new Error('Network error'))
              break
            case 'invalid_json':
              mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => { throw new Error('Invalid JSON') }
              })
              break
            case 'api_error':
              mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
              })
              break
            case 'timeout':
              mockFetch.mockImplementationOnce(() => 
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout')), 100)
                )
              )
              break
          }

          const engine = new StatisticsEngine({
            apiEndpoint: '/api/statistics',
            retryAttempts: 1, // Reduce retries for faster testing
            retryDelay: 10
          })

          // Attempt to fetch statistics (should fail)
          let errorOccurred = false
          try {
            await engine.fetchStatistics()
          } catch (error) {
            errorOccurred = true
          }

          // Verify error occurred as expected
          expect(errorOccurred).toBe(true)

          // Verify the engine handles errors gracefully
          // The engine should still be functional and have fallback behavior
          expect(engine.getCurrentStats()).toBeNull() // Should be null when no data loaded

          // Test that formatting methods still work with fallback values
          const fallbackValue = engine.formatStatisticValue(null, 'number_with_suffix')
          expect(fallbackValue).toBe('0')

          const fallbackTimestamp = engine.formatTimestamp(null)
          expect(fallbackTimestamp).toBe('unknown')

          // Cleanup
          engine.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })
})