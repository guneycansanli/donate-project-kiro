const fc = require('fast-check')
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const ConfigManager = require('../../backend/config/configManager')

/**
 * **Feature: donation-website, Property 10: Configuration Update Responsiveness**
 * **Validates: Requirements 4.1, 4.2**
 * 
 * For any YAML configuration file change, the system should detect, validate, 
 * and apply updates within 30 seconds while maintaining data integrity
 */

describe('Property-Based Tests: Configuration Update Responsiveness', () => {
  let configManager
  let tempConfigDir

  beforeEach(async () => {
    // Create temporary config directory for testing
    tempConfigDir = path.join(__dirname, 'temp-config-' + Date.now())
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
   * Property 10: Configuration Update Responsiveness
   * For any valid configuration change, the system should detect and apply updates
   * while maintaining data integrity
   */
  test('Property 10: Configuration updates maintain data integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid statistics configuration
        fc.record({
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
            }),
            global_impact: fc.record({
              value: fc.string({ minLength: 1, maxLength: 20 }),
              label: fc.string({ minLength: 1, maxLength: 50 }),
              icon: fc.constantFrom('public', 'language', 'globe'),
              format: fc.constant('text')
            })
          }),
          update_frequency: fc.integer({ min: 1, max: 300 }),
          last_updated: fc.date().map(d => d.toISOString())
        }),
        async (statisticsConfig) => {
          // Initialize configuration manager
          await configManager.initialize()
          
          // Get initial configuration
          const initialConfig = configManager.getConfig('statistics')
          
          // Write new configuration to file
          const configPath = path.join(tempConfigDir, 'statistics.yml')
          const yamlContent = yaml.dump(statisticsConfig)
          fs.writeFileSync(configPath, yamlContent, 'utf8')
          
          // Reload configuration
          await configManager.loadConfig('statistics.yml')
          
          // Get updated configuration
          const updatedConfig = configManager.getConfig('statistics')
          
          // Verify data integrity is maintained
          expect(updatedConfig).toBeDefined()
          expect(updatedConfig.statistics).toBeDefined()
          expect(updatedConfig.statistics.trees_planted).toBeDefined()
          expect(updatedConfig.statistics.hectares_restored).toBeDefined()
          expect(updatedConfig.statistics.global_impact).toBeDefined()
          
          // Verify values are properly loaded
          expect(updatedConfig.statistics.trees_planted.value).toBe(statisticsConfig.statistics.trees_planted.value)
          expect(updatedConfig.statistics.hectares_restored.value).toBe(statisticsConfig.statistics.hectares_restored.value)
          expect(updatedConfig.statistics.global_impact.value).toBe(statisticsConfig.statistics.global_impact.value)
          
          // Verify update frequency is applied
          expect(updatedConfig.update_frequency).toBe(statisticsConfig.update_frequency)
          
          // Verify configuration structure is preserved
          expect(typeof updatedConfig.statistics.trees_planted.value).toBe('number')
          expect(typeof updatedConfig.statistics.hectares_restored.value).toBe('number')
          expect(typeof updatedConfig.statistics.global_impact.value).toBe('string')
          expect(typeof updatedConfig.update_frequency).toBe('number')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Configuration validation maintains required structure
   * For any configuration input, validation should ensure required fields exist
   */
  test('Property: Configuration validation preserves required structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate partial or complete content configuration
        fc.record({
          site: fc.record({
            title: fc.string({ minLength: 1, maxLength: 100 }),
            tagline: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
            description: fc.option(fc.string({ minLength: 1, maxLength: 500 }))
          }),
          paypal: fc.record({
            business_id: fc.string({ minLength: 10, maxLength: 20 }),
            currency: fc.constantFrom('USD', 'EUR', 'GBP'),
            amounts: fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 10 })
          })
        }),
        async (contentConfig) => {
          // Initialize configuration manager
          await configManager.initialize()
          
          // Write configuration to file
          const configPath = path.join(tempConfigDir, 'content.yml')
          const yamlContent = yaml.dump(contentConfig)
          fs.writeFileSync(configPath, yamlContent, 'utf8')
          
          // Load and validate configuration
          await configManager.loadConfig('content.yml')
          const validatedConfig = configManager.getConfig('content')
          
          // Verify required structure is maintained
          expect(validatedConfig).toBeDefined()
          expect(validatedConfig.site).toBeDefined()
          expect(validatedConfig.paypal).toBeDefined()
          expect(validatedConfig.tabs).toBeDefined() // Should be filled from defaults
          
          // Verify input values are preserved
          expect(validatedConfig.site.title).toBe(contentConfig.site.title)
          expect(validatedConfig.paypal.business_id).toBe(contentConfig.paypal.business_id)
          expect(validatedConfig.paypal.currency).toBe(contentConfig.paypal.currency)
          expect(validatedConfig.paypal.amounts).toEqual(contentConfig.paypal.amounts)
          
          // Verify defaults are applied for missing optional fields
          if (!contentConfig.site.tagline) {
            expect(validatedConfig.site.tagline).toBeDefined()
          }
          if (!contentConfig.site.description) {
            expect(validatedConfig.site.description).toBeDefined()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Configuration changes trigger appropriate events
   * For any configuration change, the system should emit proper events
   */
  test('Property: Configuration changes emit proper events', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          app: fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            version: fc.string({ minLength: 1, maxLength: 20 }),
            environment: fc.constantFrom('development', 'staging', 'production')
          }),
          api: fc.record({
            poll_interval: fc.integer({ min: 1000, max: 60000 }),
            timeout: fc.integer({ min: 1000, max: 30000 }),
            retry_attempts: fc.integer({ min: 1, max: 10 })
          })
        }),
        async (settingsConfig) => {
          // Initialize configuration manager
          await configManager.initialize()
          
          // Set up event listener
          let configLoadedEvent = null
          configManager.on('configLoaded', (event) => {
            configLoadedEvent = event
          })
          
          // Write configuration to file
          const configPath = path.join(tempConfigDir, 'settings.yml')
          const yamlContent = yaml.dump(settingsConfig)
          fs.writeFileSync(configPath, yamlContent, 'utf8')
          
          // Load configuration
          await configManager.loadConfig('settings.yml')
          
          // Verify event was emitted
          expect(configLoadedEvent).toBeDefined()
          expect(configLoadedEvent.name).toBe('settings')
          expect(configLoadedEvent.config).toBeDefined()
          
          // Verify event contains correct configuration
          expect(configLoadedEvent.config.app.name).toBe(settingsConfig.app.name)
          expect(configLoadedEvent.config.api.poll_interval).toBe(settingsConfig.api.poll_interval)
        }
      ),
      { numRuns: 100 }
    )
  })
})