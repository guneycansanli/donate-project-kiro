const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const chokidar = require('chokidar')
const { EventEmitter } = require('events')

/**
 * YAML Configuration Manager
 * Handles loading, validation, and watching of YAML configuration files
 */
class ConfigManager extends EventEmitter {
  constructor (configDir = path.join(__dirname, '../../config')) {
    super()
    this.configDir = configDir
    this.configs = new Map()
    this.watchers = new Map()
    this.defaultConfigs = this.getDefaultConfigs()
    this.validationSchemas = this.getValidationSchemas()
  }

  /**
   * Initialize the configuration manager
   * Load all configuration files and set up watchers
   */
  async initialize () {
    try {
      // Ensure config directory exists
      await this.ensureConfigDirectory()

      // Load all configuration files
      await this.loadAllConfigs()

      // Set up file watchers
      this.setupWatchers()

      console.log('Configuration manager initialized successfully')
    } catch (error) {
      console.error('Failed to initialize configuration manager:', error)
      throw error
    }
  }

  /**
   * Load all configuration files
   */
  async loadAllConfigs () {
    const configFiles = ['statistics.yml', 'content.yml', 'settings.yml']

    for (const filename of configFiles) {
      await this.loadConfig(filename)
    }
  }

  /**
   * Load a specific configuration file
   * @param {string} filename - Name of the configuration file
   */
  async loadConfig (filename) {
    const configName = path.basename(filename, '.yml')
    const filePath = path.join(this.configDir, filename)

    try {
      // Check if file exists, create from template if not
      if (!fs.existsSync(filePath)) {
        await this.createTemplateFile(filename)
      }

      // Read and parse YAML file
      const fileContent = fs.readFileSync(filePath, 'utf8')
      const config = yaml.load(fileContent)

      // Validate configuration
      const validatedConfig = this.validateConfig(configName, config)

      // Store configuration
      this.configs.set(configName, validatedConfig)

      console.log(`Loaded configuration: ${configName}`)
      this.emit('configLoaded', { name: configName, config: validatedConfig })
    } catch (error) {
      console.error(`Failed to load config ${filename}:`, error)

      // Always emit error event
      this.emit('configError', { name: configName, error, usingDefault: false })

      // Use default configuration on error
      const defaultConfig = this.defaultConfigs[configName]
      if (defaultConfig) {
        this.configs.set(configName, defaultConfig)
        console.log(`Using default configuration for ${configName}`)
        this.emit('configError', { name: configName, error, usingDefault: true })
      } else {
        throw error
      }
    }
  }

  /**
   * Get configuration by name
   * @param {string} name - Configuration name
   * @returns {Object} Configuration object
   */
  getConfig (name) {
    return this.configs.get(name) || this.defaultConfigs[name] || {}
  }

  /**
   * Get all configurations
   * @returns {Object} All configurations
   */
  getAllConfigs () {
    const allConfigs = {}
    for (const [name, config] of this.configs) {
      allConfigs[name] = config
    }
    return allConfigs
  }

  /**
   * Validate configuration against schema
   * @param {string} configName - Name of the configuration
   * @param {Object} config - Configuration object to validate
   * @returns {Object} Validated configuration with defaults applied
   */
  validateConfig (configName, config) {
    const schema = this.validationSchemas[configName]
    if (!schema) {
      return config
    }

    // Apply defaults and validate
    const validatedConfig = this.applyDefaults(config, this.defaultConfigs[configName])

    // Perform type validation
    this.performTypeValidation(configName, validatedConfig, schema)

    return validatedConfig
  }

  /**
   * Apply default values to configuration
   * @param {Object} config - Configuration object
   * @param {Object} defaults - Default values
   * @returns {Object} Configuration with defaults applied
   */
  applyDefaults (config, defaults) {
    if (!defaults) return config

    const result = { ...defaults }

    for (const [key, value] of Object.entries(config || {})) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.applyDefaults(value, defaults[key])
      } else {
        result[key] = value
      }
    }

    return result
  }

  /**
   * Perform type validation and coercion on configuration
   * @param {string} configName - Name of the configuration
   * @param {Object} config - Configuration to validate
   * @param {Object} schema - Validation schema
   */
  performTypeValidation (configName, config, schema) {
    for (const [keyPath, expectedType] of Object.entries(schema)) {
      const keys = keyPath.split('.')
      let current = config

      // Navigate to the nested property
      for (let i = 0; i < keys.length - 1; i++) {
        if (current[keys[i]] === undefined || current[keys[i]] === null) {
          break
        }
        current = current[keys[i]]
      }

      const finalKey = keys[keys.length - 1]
      if (current && current[finalKey] !== undefined && current[finalKey] !== null) {
        const actualType = typeof current[finalKey]
        if (actualType !== expectedType && expectedType !== 'any') {
          console.warn(`Configuration ${configName}.${keyPath}: expected ${expectedType}, got ${actualType}`)

          // Attempt type coercion
          try {
            if (expectedType === 'number') {
              if (actualType === 'string') {
                const numValue = Number(current[finalKey])
                if (!isNaN(numValue)) {
                  current[finalKey] = numValue
                  console.log(`Configuration ${configName}.${keyPath}: coerced "${current[finalKey]}" to ${numValue}`)
                } else {
                  // Use default value for non-numeric strings
                  const defaultValue = this.getDefaultValueForPath(configName, keyPath)
                  if (typeof defaultValue === 'number') {
                    current[finalKey] = defaultValue
                    console.log(`Configuration ${configName}.${keyPath}: used default value ${defaultValue} for non-numeric string`)
                  }
                }
              } else if (actualType === 'object' || actualType === 'boolean') {
                // Use default value for objects/arrays/booleans that can't be coerced
                const defaultValue = this.getDefaultValueForPath(configName, keyPath)
                if (typeof defaultValue === 'number') {
                  current[finalKey] = defaultValue
                  console.log(`Configuration ${configName}.${keyPath}: used default value ${defaultValue} for ${actualType}`)
                }
              }
            } else if (expectedType === 'string') {
              if (actualType === 'number' || actualType === 'boolean') {
                current[finalKey] = String(current[finalKey])
                console.log(`Configuration ${configName}.${keyPath}: coerced ${current[finalKey]} to string`)
              } else if (actualType === 'object') {
                // Use default value for objects/arrays
                const defaultValue = this.getDefaultValueForPath(configName, keyPath)
                if (typeof defaultValue === 'string') {
                  current[finalKey] = defaultValue
                  console.log(`Configuration ${configName}.${keyPath}: used default value "${defaultValue}" for object`)
                }
              }
            } else if (expectedType === 'boolean' && (actualType === 'string' || actualType === 'number')) {
              current[finalKey] = Boolean(current[finalKey])
              console.log(`Configuration ${configName}.${keyPath}: coerced to boolean`)
            }
          } catch (error) {
            console.warn(`Configuration ${configName}.${keyPath}: failed to coerce type - ${error.message}`)
          }
        }
      }
    }
  }

  /**
   * Set up file watchers for configuration files
   */
  setupWatchers () {
    const configFiles = ['statistics.yml', 'content.yml', 'settings.yml']

    for (const filename of configFiles) {
      const filePath = path.join(this.configDir, filename)
      const watcher = chokidar.watch(filePath, {
        persistent: true,
        ignoreInitial: true
      })

      watcher.on('change', async () => {
        console.log(`Configuration file changed: ${filename}`)
        try {
          await this.loadConfig(filename)
          this.emit('configChanged', { filename, timestamp: new Date().toISOString() })
        } catch (error) {
          console.error(`Failed to reload config ${filename}:`, error)
          this.emit('configError', { filename, error })
        }
      })

      this.watchers.set(filename, watcher)
    }
  }

  /**
   * Create template configuration file
   * @param {string} filename - Name of the configuration file
   */
  async createTemplateFile (filename) {
    const configName = path.basename(filename, '.yml')
    const defaultConfig = this.defaultConfigs[configName]

    if (!defaultConfig) {
      throw new Error(`No default configuration available for ${configName}`)
    }

    const filePath = path.join(this.configDir, filename)
    const yamlContent = yaml.dump(defaultConfig, { indent: 2 })

    fs.writeFileSync(filePath, yamlContent, 'utf8')
    console.log(`Created template configuration file: ${filename}`)
  }

  /**
   * Ensure configuration directory exists
   */
  async ensureConfigDirectory () {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true })
      console.log(`Created configuration directory: ${this.configDir}`)
    }
  }

  /**
   * Get default configurations
   * @returns {Object} Default configurations
   */
  getDefaultConfigs () {
    return {
      statistics: {
        statistics: {
          trees_planted: {
            value: 0,
            label: 'Trees Planted',
            icon: 'park',
            format: 'number_with_suffix'
          },
          hectares_restored: {
            value: 0,
            label: 'Hectares Restored',
            icon: 'landscape',
            format: 'number_with_plus'
          },
          global_impact: {
            value: 'Worldwide',
            label: 'Global Impact',
            icon: 'public',
            format: 'text'
          }
        },
        update_frequency: 30,
        last_updated: new Date().toISOString()
      },
      content: {
        site: {
          title: 'Give Green, Live Clean',
          tagline: 'Your Donation Plants a Forest. Give Green, Live Clean.',
          description: 'Join our mission to reforest the planet.'
        },
        tabs: {
          home: { title: 'Home', content: 'Welcome to our environmental mission...' },
          about: { title: 'About Us', content: 'Learn about our organization...' },
          impact: { title: 'Our Impact', content: 'See how donations make a difference...' },
          donate: { title: 'Donate', content: 'Support our cause today...' }
        },
        paypal: {
          business_id: '73PLJSAMMTSCW',
          currency: 'USD',
          amounts: [10, 25, 50, 100, 250]
        }
      },
      settings: {
        app: {
          name: 'Give Green Live Clean',
          version: '1.0.0',
          environment: 'production'
        },
        ui: {
          theme: {
            primary_color: '#0df20d',
            background_light: '#f5f8f5',
            background_dark: '#102210'
          },
          responsive: {
            mobile_breakpoint: '768px',
            tablet_breakpoint: '1024px'
          }
        },
        api: {
          poll_interval: 30000,
          timeout: 5000,
          retry_attempts: 3
        }
      }
    }
  }

  /**
   * Get validation schemas for configurations
   * @returns {Object} Validation schemas
   */
  getValidationSchemas () {
    return {
      statistics: {
        'statistics.trees_planted.value': 'number',
        'statistics.trees_planted.label': 'string',
        'statistics.trees_planted.format': 'string',
        'statistics.hectares_restored.value': 'number',
        'statistics.hectares_restored.label': 'string',
        'statistics.hectares_restored.format': 'string',
        'statistics.global_impact.value': 'string',
        'statistics.global_impact.label': 'string',
        'statistics.global_impact.format': 'string',
        update_frequency: 'number',
        last_updated: 'string'
      },
      content: {
        'site.title': 'string',
        'site.tagline': 'string',
        'site.description': 'string',
        'paypal.business_id': 'string',
        'paypal.currency': 'string',
        'paypal.amounts': 'object'
      },
      settings: {
        'app.name': 'string',
        'app.version': 'string',
        'app.environment': 'string',
        'api.poll_interval': 'number',
        'api.timeout': 'number',
        'api.retry_attempts': 'number'
      }
    }
  }

  /**
   * Get default value for a specific configuration path
   * @param {string} configName - Name of the configuration
   * @param {string} keyPath - Dot-separated path to the value
   * @returns {*} Default value or undefined
   */
  getDefaultValueForPath (configName, keyPath) {
    const defaultConfig = this.defaultConfigs[configName]
    if (!defaultConfig) return undefined

    const keys = keyPath.split('.')
    let current = defaultConfig

    for (const key of keys) {
      if (current && typeof current === 'object' && current[key] !== undefined) {
        current = current[key]
      } else {
        return undefined
      }
    }

    return current
  }

  /**
   * Clean up watchers and resources
   */
  async cleanup () {
    for (const [filename, watcher] of this.watchers) {
      await watcher.close()
      console.log(`Closed watcher for ${filename}`)
    }
    this.watchers.clear()
    this.configs.clear()
  }
}

module.exports = ConfigManager
