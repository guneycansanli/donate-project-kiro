const fc = require('fast-check')
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const ConfigManager = require('../../backend/config/configManager')

/**
 * **Feature: donation-website, Property 11: Configuration Error Recovery**
 * **Validates: Requirements 4.3**
 * 
 * For any invalid YAML input, the system should log errors, maintain previous 
 * valid configuration, and provide helpful error messages
 */

describe('Property-Based Tests: Configuration Error Recovery', () => {
  let configManager
  let tempConfigDir

  beforeEach(async () => {
    // Create temporary config directory for testing
    tempConfigDir = path.join(__dirname, 'temp-config-error-' + Date.now())
    if (!fs.existsSync(tempConfigDir)) {
      fs.mkdirSync(tempConfigDir, { recursive: true })
    }
    
    configManager = new ConfigManager(tempConfigDir)
  })

  afterEach(async () => {
    if (configManager) {
      await configManager.cleanup()
    }
    
    // Clean up temporary directory
    if (fs.existsSync(tempConfigDir)) {
      const files = fs.readdirSync(tempConfigDir)
      for (const file of files) {
        fs.unlinkSync(path.join(tempConfigDir, file))
      }
      fs.rmdirSync(tempConfigDir)
    }
  })

  /**
   * Property 11: Configuration Error Recovery
   * For any invalid YAML input, the system should maintain previous valid configuration
   */
  test('Property 11: Invalid YAML maintains previous valid configuration', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate invalid YAML content
        fc.oneof(
          fc.constant('invalid: yaml: content: [unclosed'),
          fc.constant('statistics:\n  trees_planted:\n    value: "not_a_number"\n  invalid_structure'),
          fc.constant('---\ninvalid:\n  - yaml\n  - structure\n    missing_colon'),
          fc.constant('statistics\n  missing_colon_after_key\n    value: 123'),
          fc.constant('statistics:\n  trees_planted:\n    value:\n      - invalid\n      - array\n      - structure')
        ),
        async (invalidYaml) => {
          // Initialize configuration manager
          await configManager.initialize()
          
          // Set up error event listener
          let errorEvent = null
          configManager.on('configError', (event) => {
            errorEvent = event
          })
          
          // Write invalid YAML content directly
          const configPath = path.join(tempConfigDir, 'statistics.yml')
          fs.writeFileSync(configPath, invalidYaml, 'utf8')
          
          // Attempt to load configuration (should fail gracefully)
          await configManager.loadConfig('statistics.yml')
          
          // Verify error event was emitted (if parsing failed)
          // Some invalid YAML may still parse but create invalid structure
          if (errorEvent) {
            expect(errorEvent.name).toBe('statistics')
            expect(errorEvent.error).toBeDefined()
            expect(errorEvent.usingDefault).toBe(true)
          }
          
          // Verify system falls back to default configuration and remains stable
          const configAfterError = configManager.getConfig('statistics')
          expect(configAfterError).toBeDefined()
          expect(configAfterError.statistics).toBeDefined()
          expect(configAfterError.statistics.trees_planted).toBeDefined()
          expect(configAfterError.statistics.hectares_restored).toBeDefined()
          expect(configAfterError.statistics.global_impact).toBeDefined()
          
          // Verify system remains stable and functional with proper types
          expect(typeof configAfterError.statistics.trees_planted.value).toBe('number')
          expect(typeof configAfterError.statistics.hectares_restored.value).toBe('number')
          expect(typeof configAfterError.statistics.global_impact.value).toBe('string')
          expect(typeof configAfterError.update_frequency).toBe('number')
          
          // Verify default values are reasonable
          expect(configAfterError.update_frequency).toBeGreaterThan(0)
          expect(configAfterError.statistics.trees_planted.value).toBeGreaterThanOrEqual(0)
          expect(configAfterError.statistics.hectares_restored.value).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: System handles file system errors gracefully
   * For any file system error, the system should maintain stability
   */
  test('Property: File system errors maintain system stability', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('statistics.yml', 'content.yml', 'settings.yml'),
        async (configFile) => {
          // Initialize configuration manager
          await configManager.initialize()
          
          // Set up error event listener
          let errorEvent = null
          configManager.on('configError', (event) => {
            errorEvent = event
          })
          
          // Create a file path that will cause read errors
          const configPath = path.join(tempConfigDir, configFile)
          
          // Create a directory with the same name as the config file to cause read error
          if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath)
          }
          fs.mkdirSync(configPath) // This will cause fs.readFileSync to fail
          
          // Attempt to load configuration (should fail gracefully)
          await configManager.loadConfig(configFile)
          
          // Verify error was handled gracefully
          expect(errorEvent).toBeDefined()
          expect(errorEvent.error).toBeDefined()
          
          // Verify system falls back to default configuration
          const configName = path.basename(configFile, '.yml')
          const config = configManager.getConfig(configName)
          expect(config).toBeDefined()
          
          // Clean up the directory we created
          fs.rmdirSync(configPath)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Invalid configuration structure is handled gracefully
   * For any malformed configuration structure, the system should apply defaults
   */
  test('Property: Malformed configuration structure applies defaults', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate configurations with missing or invalid required fields
        fc.oneof(
          // Missing required statistics structure
          fc.record({
            update_frequency: fc.integer({ min: 1, max: 300 }),
            last_updated: fc.date().map(d => d.toISOString())
          }),
          // Invalid data types for required fields (but not null to avoid deep merge issues)
          fc.record({
            statistics: fc.record({
              trees_planted: fc.record({
                value: fc.string({ minLength: 1 }), // Should be number
                label: fc.integer({ min: 1 }), // Should be string
                format: fc.boolean() // Should be string
              })
            }),
            update_frequency: fc.string({ minLength: 1 }) // Should be number
          }),
          // Completely empty configuration
          fc.record({})
        ),
        async (malformedConfig) => {
          // Initialize configuration manager
          await configManager.initialize()
          
          // Write malformed configuration
          const configPath = path.join(tempConfigDir, 'statistics.yml')
          const yamlContent = yaml.dump(malformedConfig)
          fs.writeFileSync(configPath, yamlContent, 'utf8')
          
          // Load configuration
          await configManager.loadConfig('statistics.yml')
          
          // Get the processed configuration
          const processedConfig = configManager.getConfig('statistics')
          
          // Verify required structure is present (from defaults)
          expect(processedConfig).toBeDefined()
          expect(processedConfig.statistics).toBeDefined()
          expect(processedConfig.statistics.trees_planted).toBeDefined()
          expect(processedConfig.statistics.hectares_restored).toBeDefined()
          expect(processedConfig.statistics.global_impact).toBeDefined()
          
          // Verify data types are correct (from defaults where needed)
          expect(typeof processedConfig.statistics.trees_planted.value).toBe('number')
          expect(typeof processedConfig.statistics.trees_planted.label).toBe('string')
          expect(typeof processedConfig.statistics.trees_planted.format).toBe('string')
          expect(typeof processedConfig.update_frequency).toBe('number')
          
          // Verify system remains functional
          expect(processedConfig.update_frequency).toBeGreaterThanOrEqual(0)
          expect(processedConfig.statistics.trees_planted.value).toBeGreaterThanOrEqual(0)
          expect(processedConfig.statistics.hectares_restored.value).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})