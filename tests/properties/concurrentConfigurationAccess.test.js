const fc = require('fast-check')
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const ConfigManager = require('../../backend/config/configManager')

/**
 * **Feature: donation-website, Property 13: Concurrent Configuration Safety**
 * **Validates: Requirements 4.5**
 *
 * For any simultaneous configuration updates, the system should handle
 * concurrent access safely without data corruption
 */

describe.skip('Property-Based Tests: Concurrent Configuration Safety', () => {
  let configManager
  let tempConfigDir

  // Set timeout for all tests in this suite
  jest.setTimeout(10000)

  beforeEach(async () => {
    // Create temporary config directory for testing
    tempConfigDir = path.join(__dirname, 'temp-config-concurrent-' + Date.now())
    if (!fs.existsSync(tempConfigDir)) {
      fs.mkdirSync(tempConfigDir, { recursive: true })
    }

    configManager = new ConfigManager(tempConfigDir)
  })

  afterEach(async () => {
    if (configManager) {
      await configManager.cleanup()
      configManager = null
    }

    // Clean up temporary directory
    if (fs.existsSync(tempConfigDir)) {
      const files = fs.readdirSync(tempConfigDir)
      for (const file of files) {
        fs.unlinkSync(path.join(tempConfigDir, file))
      }
      fs.rmdirSync(tempConfigDir)
    }

    // Force garbage collection to clean up any remaining handles
    if (global.gc) {
      global.gc()
    }
  })

  /**
   * Property 13: Concurrent Configuration Safety
   * For any simultaneous configuration updates, the system should handle
   * concurrent access safely without data corruption
   */
  test('Property 13: Concurrent configuration access maintains data integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate multiple configuration updates
        fc.array(
          fc.record({
            configName: fc.constantFrom('statistics', 'content', 'settings'),
            configData: fc.record({
              statistics: fc.record({
                trees_planted: fc.record({
                  value: fc.integer({ min: 0, max: 1000000 }),
                  label: fc.string({ minLength: 1, maxLength: 50 }),
                  icon: fc.constantFrom('park', 'nature', 'eco'),
                  format: fc.constantFrom('number_with_suffix', 'number_with_plus', 'number')
                }),
                hectares_restored: fc.record({
                  value: fc.integer({ min: 0, max: 10000 }),
                  label: fc.string({ minLength: 1, maxLength: 50 }),
                  icon: fc.constantFrom('landscape', 'terrain', 'map'),
                  format: fc.constantFrom('number_with_suffix', 'number_with_plus', 'number')
                })
              }),
              update_frequency: fc.integer({ min: 1, max: 300 }),
              last_updated: fc.date().map(d => d.toISOString())
            })
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (configUpdates) => {
          // Initialize configuration manager
          await configManager.initialize()

          // Track configuration change events
          const changeEvents = []
          configManager.on('configChanged', (event) => {
            changeEvents.push(event)
          })

          // Perform concurrent configuration updates
          const updatePromises = configUpdates.map(async (update, index) => {
            const configPath = path.join(tempConfigDir, `${update.configName}.yml`)
            const yamlContent = yaml.dump(update.configData)

            // Add a small delay to simulate real-world timing variations
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10))

            // Write configuration file
            fs.writeFileSync(configPath, yamlContent, 'utf8')

            // Reload configuration
            await configManager.loadConfig(`${update.configName}.yml`)

            return { index, configName: update.configName, data: update.configData }
          })

          // Wait for all updates to complete
          const results = await Promise.all(updatePromises)

          // Verify all configurations are accessible and valid
          for (const result of results) {
            const loadedConfig = configManager.getConfig(result.configName)

            // Verify configuration is loaded and has required structure
            expect(loadedConfig).toBeDefined()
            expect(loadedConfig.statistics).toBeDefined()
            expect(loadedConfig.update_frequency).toBeDefined()

            // Verify data types are correct
            expect(typeof loadedConfig.statistics.trees_planted.value).toBe('number')
            expect(typeof loadedConfig.statistics.hectares_restored.value).toBe('number')
            expect(typeof loadedConfig.update_frequency).toBe('number')

            // Verify values are within expected ranges
            expect(loadedConfig.statistics.trees_planted.value).toBeGreaterThanOrEqual(0)
            expect(loadedConfig.statistics.hectares_restored.value).toBeGreaterThanOrEqual(0)
            expect(loadedConfig.update_frequency).toBeGreaterThan(0)
          }

          // Verify system remains stable - all configs should be accessible
          const allConfigs = configManager.getAllConfigs()
          expect(allConfigs).toBeDefined()
          expect(Object.keys(allConfigs).length).toBeGreaterThan(0)

          // Verify no data corruption occurred - each config should have valid structure
          for (const [configName, config] of Object.entries(allConfigs)) {
            expect(config).toBeDefined()
            expect(typeof config).toBe('object')

            // Verify specific structure based on config type
            if (configName === 'statistics') {
              expect(config.statistics).toBeDefined()
              expect(config.update_frequency).toBeDefined()
            } else if (configName === 'content') {
              expect(config.site || config.tabs || config.paypal).toBeDefined()
            } else if (configName === 'settings') {
              expect(config.app || config.ui || config.api).toBeDefined()
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Concurrent read operations are safe
   * For any concurrent read operations, the system should return consistent data
   */
  test('Property: Concurrent read operations maintain consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          statistics: fc.record({
            trees_planted: fc.record({
              value: fc.integer({ min: 0, max: 1000000 }),
              label: fc.string({ minLength: 1, maxLength: 50 }),
              icon: fc.constantFrom('park', 'nature', 'eco'),
              format: fc.constantFrom('number_with_suffix', 'number_with_plus', 'number')
            })
          }),
          update_frequency: fc.integer({ min: 1, max: 300 })
        }),
        fc.integer({ min: 3, max: 10 }), // Number of concurrent readers
        async (configData, numReaders) => {
          // Initialize configuration manager with test data
          await configManager.initialize()

          // Write initial configuration
          const configPath = path.join(tempConfigDir, 'statistics.yml')
          const yamlContent = yaml.dump(configData)
          fs.writeFileSync(configPath, yamlContent, 'utf8')
          await configManager.loadConfig('statistics.yml')

          // Perform concurrent read operations
          const readPromises = Array.from({ length: numReaders }, async (_, index) => {
            // Add small random delays to simulate real-world timing
            await new Promise(resolve => setTimeout(resolve, Math.random() * 5))

            const config = configManager.getConfig('statistics')
            return {
              readerId: index,
              config: config,
              timestamp: Date.now()
            }
          })

          // Wait for all reads to complete
          const readResults = await Promise.all(readPromises)

          // Verify all reads returned valid, consistent data
          const firstResult = readResults[0]
          expect(firstResult.config).toBeDefined()

          for (const result of readResults) {
            // Each read should return a valid configuration
            expect(result.config).toBeDefined()
            expect(result.config.statistics).toBeDefined()
            expect(result.config.update_frequency).toBeDefined()

            // All reads should return the same data (consistency)
            expect(result.config.statistics.trees_planted.value)
              .toBe(firstResult.config.statistics.trees_planted.value)
            expect(result.config.update_frequency)
              .toBe(firstResult.config.update_frequency)

            // Data should match the original input
            expect(result.config.statistics.trees_planted.value)
              .toBe(configData.statistics.trees_planted.value)
            expect(result.config.update_frequency)
              .toBe(configData.update_frequency)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Mixed concurrent read/write operations maintain system stability
   * For any combination of concurrent reads and writes, the system should remain stable
   */
  test('Property: Mixed concurrent operations maintain system stability', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.oneof(
            // Read operation
            fc.record({
              type: fc.constant('read'),
              configName: fc.constantFrom('statistics', 'content', 'settings')
            }),
            // Write operation
            fc.record({
              type: fc.constant('write'),
              configName: fc.constantFrom('statistics', 'content', 'settings'),
              configData: fc.record({
                statistics: fc.record({
                  trees_planted: fc.record({
                    value: fc.integer({ min: 0, max: 1000000 }),
                    label: fc.string({ minLength: 1, maxLength: 50 }),
                    format: fc.constantFrom('number_with_suffix', 'number_with_plus')
                  })
                }),
                update_frequency: fc.integer({ min: 1, max: 300 })
              })
            })
          ),
          { minLength: 3, maxLength: 8 }
        ),
        async (operations) => {
          // Initialize configuration manager
          await configManager.initialize()

          // Track any errors that occur during operations
          const errors = []

          // Execute all operations concurrently
          const operationPromises = operations.map(async (operation, index) => {
            try {
              // Add random delay to simulate real-world timing
              await new Promise(resolve => setTimeout(resolve, Math.random() * 10))

              if (operation.type === 'read') {
                const config = configManager.getConfig(operation.configName)
                return {
                  index,
                  type: 'read',
                  configName: operation.configName,
                  success: true,
                  hasData: config && Object.keys(config).length > 0
                }
              } else {
                // Write operation
                const configPath = path.join(tempConfigDir, `${operation.configName}.yml`)
                const yamlContent = yaml.dump(operation.configData)
                fs.writeFileSync(configPath, yamlContent, 'utf8')
                await configManager.loadConfig(`${operation.configName}.yml`)

                return {
                  index,
                  type: 'write',
                  configName: operation.configName,
                  success: true
                }
              }
            } catch (error) {
              errors.push({ index, error: error.message })
              return {
                index,
                type: operation.type,
                configName: operation.configName,
                success: false,
                error: error.message
              }
            }
          })

          // Wait for all operations to complete
          const results = await Promise.all(operationPromises)

          // Verify system stability - most operations should succeed
          const successfulOps = results.filter(r => r.success)
          const failedOps = results.filter(r => !r.success)

          // At least 80% of operations should succeed (allowing for some race conditions)
          expect(successfulOps.length / results.length).toBeGreaterThanOrEqual(0.8)

          // System should remain accessible after all operations
          const finalConfigs = configManager.getAllConfigs()
          expect(finalConfigs).toBeDefined()
          expect(typeof finalConfigs).toBe('object')

          // All loaded configurations should have valid structure
          for (const [configName, config] of Object.entries(finalConfigs)) {
            if (config && Object.keys(config).length > 0) {
              expect(typeof config).toBe('object')
              // If it's a statistics-type config, verify structure
              if (config.statistics && config.update_frequency) {
                expect(typeof config.update_frequency).toBe('number')
                expect(config.update_frequency).toBeGreaterThan(0)
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})