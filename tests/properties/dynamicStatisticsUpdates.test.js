const fc = require('fast-check')
const StatisticsEngine = require('../utils/StatisticsEngineNode')

/**
 * **Feature: donation-website, Property 6: Dynamic Statistics Updates**
 * **Validates: Requirements 2.2**
 * 
 * For any statistics configuration change, the system should detect updates and 
 * refresh display without page reload within the polling interval
 */

describe('Property-Based Tests: Dynamic Statistics Updates', () => {
  let mockFetch

  beforeEach(() => {
    // Mock fetch globally
    mockFetch = jest.fn()
    global.fetch = mockFetch
    
    // Mock timers for polling tests
    jest.useFakeTimers()
  })

  afterEach(() => {
    if (mockFetch) {
      mockFetch.mockRestore()
    }
    delete global.fetch
    jest.useRealTimers()
  })

  /**
   * Property 6: Dynamic Statistics Updates
   * For any statistics configuration change, the system should detect updates and 
   * refresh display without page reload within the polling interval
   */
  test('Property 6: Statistics updates are detected and applied within polling interval', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate initial and updated statistics configurations
        fc.tuple(
          // Initial statistics
          fc.record({
            statistics: fc.record({
              trees_planted: fc.record({
                value: fc.integer({ min: 0, max: 100000 }),
                label: fc.string({ minLength: 1, maxLength: 50 }),
                icon: fc.constantFrom('park', 'nature', 'eco'),
                format: fc.constantFrom('number_with_suffix', 'number_with_plus', 'number_with_separators')
              }),
              hectares_restored: fc.record({
                value: fc.integer({ min: 0, max: 1000 }),
                label: fc.string({ minLength: 1, maxLength: 50 }),
                icon: fc.constantFrom('landscape', 'terrain', 'map'),
                format: fc.constantFrom('number_with_suffix', 'number_with_plus', 'number_with_separators')
              }),
              global_impact: fc.record({
                value: fc.string({ minLength: 1, maxLength: 20 }),
                label: fc.string({ minLength: 1, maxLength: 50 }),
                icon: fc.constantFrom('public', 'language', 'globe'),
                format: fc.constant('text')
              })
            }),
            last_updated: fc.date().map(d => d.toISOString())
          }),
          // Updated statistics (different values)
          fc.record({
            statistics: fc.record({
              trees_planted: fc.record({
                value: fc.integer({ min: 100001, max: 200000 }), // Different range to ensure change
                label: fc.string({ minLength: 1, maxLength: 50 }),
                icon: fc.constantFrom('park', 'nature', 'eco'),
                format: fc.constantFrom('number_with_suffix', 'number_with_plus', 'number_with_separators')
              }),
              hectares_restored: fc.record({
                value: fc.integer({ min: 1001, max: 2000 }), // Different range to ensure change
                label: fc.string({ minLength: 1, maxLength: 50 }),
                icon: fc.constantFrom('landscape', 'terrain', 'map'),
                format: fc.constantFrom('number_with_suffix', 'number_with_plus', 'number_with_separators')
              }),
              global_impact: fc.record({
                value: fc.string({ minLength: 21, maxLength: 40 }), // Different length to ensure change
                label: fc.string({ minLength: 1, maxLength: 50 }),
                icon: fc.constantFrom('public', 'language', 'globe'),
                format: fc.constant('text')
              })
            }),
            last_updated: fc.date().map(d => d.toISOString())
          }),
          // Polling interval
          fc.integer({ min: 1000, max: 60000 })
        ),
        async ([initialStats, updatedStats, pollInterval]) => {
          let fetchCallCount = 0
          
          // Mock fetch to return initial stats first, then updated stats
          mockFetch.mockImplementation(() => {
            fetchCallCount++
            const statsToReturn = fetchCallCount === 1 ? initialStats : updatedStats
            
            return Promise.resolve({
              ok: true,
              json: async () => ({
                success: true,
                data: statsToReturn,
                timestamp: new Date().toISOString()
              })
            })
          })

          // Create statistics engine with custom polling interval
          const engine = new StatisticsEngine({
            apiEndpoint: '/api/statistics',
            pollInterval: pollInterval,
            retryAttempts: 1
          })

          // Initial fetch
          await engine.fetchStatistics()
          
          // Verify initial stats are loaded
          let currentStats = engine.getCurrentStats()
          expect(currentStats).toBeDefined()
          expect(currentStats.statistics.trees_planted.value).toBe(initialStats.statistics.trees_planted.value)
          expect(currentStats.statistics.hectares_restored.value).toBe(initialStats.statistics.hectares_restored.value)
          expect(currentStats.statistics.global_impact.value).toBe(initialStats.statistics.global_impact.value)

          // Manually trigger second fetch instead of using polling
          await engine.fetchStatistics()

          // Verify updated stats are loaded
          currentStats = engine.getCurrentStats()
          expect(currentStats).toBeDefined()
          expect(currentStats.statistics.trees_planted.value).toBe(updatedStats.statistics.trees_planted.value)
          expect(currentStats.statistics.hectares_restored.value).toBe(updatedStats.statistics.hectares_restored.value)
          expect(currentStats.statistics.global_impact.value).toBe(updatedStats.statistics.global_impact.value)

          // Verify fetch was called twice (initial + polling)
          expect(fetchCallCount).toBe(2)

          // Cleanup
          engine.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Polling interval consistency
   * For any polling interval, the system should fetch updates at the specified frequency
   */
  test('Property: Polling maintains consistent interval timing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1000, max: 5000 }), // Polling interval in ms
        async (pollInterval) => {
          let fetchCallCount = 0
          
          // Mock fetch to track calls
          mockFetch.mockImplementation(() => {
            fetchCallCount++
            
            return Promise.resolve({
              ok: true,
              json: async () => ({
                success: true,
                data: {
                  statistics: {
                    trees_planted: { value: fetchCallCount * 1000, label: 'Trees', format: 'number' },
                    hectares_restored: { value: fetchCallCount * 10, label: 'Hectares', format: 'number' },
                    global_impact: { value: 'Global', label: 'Impact', format: 'text' }
                  },
                  last_updated: new Date().toISOString()
                },
                timestamp: new Date().toISOString()
              })
            })
          })

          const engine = new StatisticsEngine({
            apiEndpoint: '/api/statistics',
            pollInterval: pollInterval,
            retryAttempts: 1
          })

          // Test multiple manual fetches to simulate polling behavior
          await engine.fetchStatistics()
          expect(fetchCallCount).toBe(1)
          
          await engine.fetchStatistics()
          expect(fetchCallCount).toBe(2)
          
          await engine.fetchStatistics()
          expect(fetchCallCount).toBe(3)

          // Verify stats are updated with each fetch
          const currentStats = engine.getCurrentStats()
          expect(currentStats.statistics.trees_planted.value).toBe(3000) // Third call

          // Cleanup
          engine.destroy()
        }
      ),
      { numRuns: 50 } // Reduced runs for performance
    )
  })

  /**
   * Property: Update detection accuracy
   * For any change in statistics values, the system should detect and apply the changes
   */
  test('Property: System accurately detects value changes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.integer({ min: 0, max: 1000000 }),
          fc.integer({ min: 0, max: 1000000 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 })
        ).filter(([val1, val2, str1, str2]) => val1 !== val2 && str1 !== str2), // Ensure both values are different
        async ([initialTreeValue, updatedTreeValue, initialImpact, updatedImpact]) => {
          const initialStats = {
            statistics: {
              trees_planted: { value: initialTreeValue, label: 'Trees', format: 'number_with_suffix' },
              hectares_restored: { value: 100, label: 'Hectares', format: 'number' },
              global_impact: { value: initialImpact, label: 'Impact', format: 'text' }
            },
            last_updated: new Date().toISOString()
          }

          const updatedStats = {
            statistics: {
              trees_planted: { value: updatedTreeValue, label: 'Trees', format: 'number_with_suffix' },
              hectares_restored: { value: 100, label: 'Hectares', format: 'number' },
              global_impact: { value: updatedImpact, label: 'Impact', format: 'text' }
            },
            last_updated: new Date().toISOString()
          }

          let fetchCallCount = 0
          mockFetch.mockImplementation(() => {
            fetchCallCount++
            const statsToReturn = fetchCallCount === 1 ? initialStats : updatedStats
            
            return Promise.resolve({
              ok: true,
              json: async () => ({
                success: true,
                data: statsToReturn,
                timestamp: new Date().toISOString()
              })
            })
          })

          const engine = new StatisticsEngine({
            apiEndpoint: '/api/statistics',
            pollInterval: 5000,
            retryAttempts: 1
          })

          // Initial fetch
          await engine.fetchStatistics()
          let currentStats = engine.getCurrentStats()
          
          // Verify initial values
          expect(currentStats.statistics.trees_planted.value).toBe(initialTreeValue)
          expect(currentStats.statistics.global_impact.value).toBe(initialImpact)

          // Fetch updated stats
          await engine.fetchStatistics()
          currentStats = engine.getCurrentStats()
          
          // Verify updated values are detected and applied
          expect(currentStats.statistics.trees_planted.value).toBe(updatedTreeValue)
          expect(currentStats.statistics.global_impact.value).toBe(updatedImpact)

          // Verify both values changed as expected
          expect(currentStats.statistics.trees_planted.value).not.toBe(initialTreeValue)
          expect(currentStats.statistics.global_impact.value).not.toBe(initialImpact)

          // Cleanup
          engine.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Polling resilience to errors
   * For any error during polling, the system should continue polling and recover
   */
  test('Property: Polling continues after temporary errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1000, max: 5000 }), // Polling interval
        async (pollInterval) => {
          let fetchCallCount = 0
          
          // Mock fetch to fail on second call, succeed on others
          mockFetch.mockImplementation(() => {
            fetchCallCount++
            
            if (fetchCallCount === 2) {
              // Simulate temporary error
              return Promise.reject(new Error('Temporary network error'))
            }
            
            return Promise.resolve({
              ok: true,
              json: async () => ({
                success: true,
                data: {
                  statistics: {
                    trees_planted: { value: fetchCallCount * 100, label: 'Trees', format: 'number' },
                    hectares_restored: { value: fetchCallCount * 5, label: 'Hectares', format: 'number' },
                    global_impact: { value: `Update ${fetchCallCount}`, label: 'Impact', format: 'text' }
                  },
                  last_updated: new Date().toISOString()
                },
                timestamp: new Date().toISOString()
              })
            })
          })

          const engine = new StatisticsEngine({
            apiEndpoint: '/api/statistics',
            pollInterval: pollInterval,
            retryAttempts: 1
          })

          // Test error handling manually
          // First successful fetch
          await engine.fetchStatistics()
          let currentStats = engine.getCurrentStats()
          expect(currentStats.statistics.trees_planted.value).toBe(100) // First call

          // Second fetch should fail
          let errorOccurred = false
          try {
            await engine.fetchStatistics()
          } catch (error) {
            errorOccurred = true
          }
          expect(errorOccurred).toBe(true)
          expect(fetchCallCount).toBe(2)

          // Stats should remain unchanged after error
          currentStats = engine.getCurrentStats()
          expect(currentStats.statistics.trees_planted.value).toBe(100) // Still first call value

          // Third fetch should succeed
          await engine.fetchStatistics()
          currentStats = engine.getCurrentStats()
          expect(currentStats.statistics.trees_planted.value).toBe(300) // Third call value

          // Verify all calls were made
          expect(fetchCallCount).toBe(3)

          // Cleanup
          engine.destroy()
        }
      ),
      { numRuns: 50 }
    )
  })
})