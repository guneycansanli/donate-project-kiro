const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const ConfigManager = require('./configManager')

// Mock dependencies
jest.mock('fs')
jest.mock('chokidar')

describe('ConfigManager', () => {
  let configManager
  let mockConfigDir

  beforeEach(() => {
    jest.clearAllMocks()
    mockConfigDir = '/test/config'
    configManager = new ConfigManager(mockConfigDir)
    
    // Mock fs.existsSync to return true by default
    fs.existsSync.mockReturnValue(true)
    
    // Mock fs.readFileSync to return valid YAML
    fs.readFileSync.mockImplementation((filePath) => {
      if (filePath.includes('statistics.yml')) {
        return yaml.dump({
          statistics: {
            trees_planted: { value: 150000, label: 'Trees Planted', icon: 'park', format: 'number_with_suffix' }
          },
          update_frequency: 30,
          last_updated: '2024-12-09T10:00:00Z'
        })
      }
      if (filePath.includes('content.yml')) {
        return yaml.dump({
          site: { title: 'Test Site', tagline: 'Test Tagline' },
          paypal: { business_id: '73PLJSAMMTSCW', currency: 'USD', amounts: [10, 25, 50] }
        })
      }
      if (filePath.includes('settings.yml')) {
        return yaml.dump({
          app: { name: 'Test App', version: '1.0.0' },
          api: { poll_interval: 30000, timeout: 5000 }
        })
      }
      return ''
    })
  })

  afterEach(async () => {
    if (configManager) {
      await configManager.cleanup()
    }
  })

  describe('Configuration Loading', () => {
    test('should load valid configuration files', async () => {
      await configManager.loadAllConfigs()
      
      expect(configManager.getConfig('statistics')).toBeDefined()
      expect(configManager.getConfig('content')).toBeDefined()
      expect(configManager.getConfig('settings')).toBeDefined()
    })

    test('should handle missing configuration files by creating templates', async () => {
      fs.existsSync.mockReturnValue(false)
      fs.writeFileSync.mockImplementation(() => {})
      
      await configManager.loadConfig('statistics.yml')
      
      expect(fs.writeFileSync).toHaveBeenCalled()
      expect(configManager.getConfig('statistics')).toBeDefined()
    })

    test('should use default configuration on YAML parsing error', async () => {
      fs.readFileSync.mockImplementation(() => 'invalid: yaml: content:')
      
      await configManager.loadConfig('statistics.yml')
      
      const config = configManager.getConfig('statistics')
      expect(config).toBeDefined()
      expect(config.statistics).toBeDefined()
    })
  })

  describe('Configuration Validation', () => {
    test('should validate configuration structure', () => {
      const testConfig = {
        statistics: {
          trees_planted: { value: 'invalid_number', label: 'Trees' }
        }
      }
      
      const validated = configManager.validateConfig('statistics', testConfig)
      expect(validated).toBeDefined()
    })

    test('should apply default values for missing properties', () => {
      const partialConfig = {
        statistics: {
          trees_planted: { value: 100 }
        }
      }
      
      const validated = configManager.validateConfig('statistics', partialConfig)
      expect(validated.update_frequency).toBeDefined()
      expect(validated.last_updated).toBeDefined()
    })
  })

  describe('Configuration Access', () => {
    beforeEach(async () => {
      await configManager.loadAllConfigs()
    })

    test('should return specific configuration by name', () => {
      const statsConfig = configManager.getConfig('statistics')
      expect(statsConfig.statistics).toBeDefined()
      expect(statsConfig.update_frequency).toBe(30)
    })

    test('should return all configurations', () => {
      const allConfigs = configManager.getAllConfigs()
      expect(allConfigs.statistics).toBeDefined()
      expect(allConfigs.content).toBeDefined()
      expect(allConfigs.settings).toBeDefined()
    })

    test('should return empty object for non-existent configuration', () => {
      const nonExistent = configManager.getConfig('nonexistent')
      expect(nonExistent).toEqual({})
    })
  })

  describe('Error Handling', () => {
    test('should handle file system errors gracefully', async () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File system error')
      })
      
      await configManager.loadConfig('statistics.yml')
      
      // Should fall back to default configuration
      const config = configManager.getConfig('statistics')
      expect(config).toBeDefined()
    })

    test('should emit error events on configuration failures', async () => {
      const errorHandler = jest.fn()
      configManager.on('configError', errorHandler)
      
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Parse error')
      })
      
      await configManager.loadConfig('statistics.yml')
      
      expect(errorHandler).toHaveBeenCalled()
    })
  })

  describe('Default Configurations', () => {
    test('should provide valid default configurations', () => {
      const defaults = configManager.getDefaultConfigs()
      
      expect(defaults.statistics).toBeDefined()
      expect(defaults.content).toBeDefined()
      expect(defaults.settings).toBeDefined()
      
      // Verify structure
      expect(defaults.statistics.statistics.trees_planted).toBeDefined()
      expect(defaults.content.paypal.business_id).toBe('73PLJSAMMTSCW')
      expect(defaults.settings.api.poll_interval).toBe(30000)
    })
  })
})