const fs = require('fs').promises
const path = require('path')

/**
 * Content Management Service
 * Handles content validation, length management, and image processing
 */
class ContentManager {
  constructor (configManager) {
    this.configManager = configManager
    this.maxContentLengths = {
      title: 100,
      tagline: 200,
      description: 500,
      tabContent: 2000,
      shortText: 50,
      mediumText: 200,
      longText: 1000
    }
    this.supportedImageFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif']
  }

  /**
   * Validate and process content configuration
   * @param {Object} content - Content configuration object
   * @returns {Object} Processed content with validation results
   */
  async validateContent (content) {
    const validationResults = {
      valid: true,
      warnings: [],
      errors: [],
      processedContent: JSON.parse(JSON.stringify(content)) // Deep clone
    }

    try {
      // Validate site content
      if (content.site) {
        await this.validateSiteContent(content.site, validationResults)
      }

      // Validate tab content
      if (content.tabs) {
        await this.validateTabContent(content.tabs, validationResults)
      }

      // Validate PayPal configuration
      if (content.paypal) {
        await this.validatePayPalContent(content.paypal, validationResults)
      }

      // Validate images
      if (content.images) {
        await this.validateImages(content.images, validationResults)
      }

      // Apply content length management
      this.applyContentLengthManagement(validationResults.processedContent, validationResults)
    } catch (error) {
      validationResults.valid = false
      validationResults.errors.push(`Content validation failed: ${error.message}`)
    }

    return validationResults
  }

  /**
   * Validate site content (title, tagline, description)
   * @param {Object} site - Site content object
   * @param {Object} validationResults - Validation results object
   */
  async validateSiteContent (site, validationResults) {
    const { processedContent } = validationResults

    // Validate title
    if (site.title) {
      if (typeof site.title !== 'string') {
        validationResults.errors.push('Site title must be a string')
        validationResults.valid = false
      } else if (site.title.length === 0) {
        validationResults.warnings.push('Site title is empty')
        processedContent.site = processedContent.site || {}
        processedContent.site.title = 'Give Green, Live Clean' // Default
      }
    }

    // Validate tagline
    if (site.tagline) {
      if (typeof site.tagline !== 'string') {
        validationResults.errors.push('Site tagline must be a string')
        validationResults.valid = false
      }
    }

    // Validate description
    if (site.description) {
      if (typeof site.description !== 'string') {
        validationResults.errors.push('Site description must be a string')
        validationResults.valid = false
      }
    }

    // Check for HTML content and sanitize if needed
    if (site.title && this.containsHTML(site.title)) {
      validationResults.warnings.push('Site title contains HTML tags - they will be stripped')
      processedContent.site = processedContent.site || {}
      processedContent.site.title = this.stripHTML(site.title)
    }
  }

  /**
   * Validate tab content
   * @param {Object} tabs - Tab content object
   * @param {Object} validationResults - Validation results object
   */
  async validateTabContent (tabs, validationResults) {
    const { processedContent } = validationResults
    const requiredTabs = ['home', 'about', 'impact', 'donate']

    processedContent.tabs = processedContent.tabs || {}

    for (const tabName of requiredTabs) {
      if (!tabs[tabName]) {
        validationResults.warnings.push(`Missing required tab: ${tabName}`)
        processedContent.tabs[tabName] = {
          title: this.capitalizeFirst(tabName),
          content: `Content for ${tabName} tab...`
        }
      } else {
        const tab = tabs[tabName]

        // Validate tab structure
        if (typeof tab !== 'object') {
          validationResults.errors.push(`Tab ${tabName} must be an object`)
          validationResults.valid = false
          continue
        }

        // Validate title
        if (!tab.title || typeof tab.title !== 'string') {
          validationResults.warnings.push(`Tab ${tabName} missing or invalid title`)
          processedContent.tabs[tabName] = processedContent.tabs[tabName] || {}
          processedContent.tabs[tabName].title = this.capitalizeFirst(tabName)
        }

        // Validate content
        if (!tab.content || typeof tab.content !== 'string') {
          validationResults.warnings.push(`Tab ${tabName} missing or invalid content`)
          processedContent.tabs[tabName] = processedContent.tabs[tabName] || {}
          processedContent.tabs[tabName].content = `Content for ${tabName} tab...`
        }
      }
    }

    // Check for extra tabs
    for (const tabName of Object.keys(tabs)) {
      if (!requiredTabs.includes(tabName)) {
        validationResults.warnings.push(`Unknown tab: ${tabName} - will be preserved but not used in navigation`)
      }
    }
  }

  /**
   * Validate PayPal configuration
   * @param {Object} paypal - PayPal configuration object
   * @param {Object} validationResults - Validation results object
   */
  async validatePayPalContent (paypal, validationResults) {
    const { processedContent } = validationResults

    processedContent.paypal = processedContent.paypal || {}

    // Validate business ID
    if (!paypal.business_id || typeof paypal.business_id !== 'string') {
      validationResults.errors.push('PayPal business_id is required and must be a string')
      validationResults.valid = false
    } else if (paypal.business_id.length < 10) {
      validationResults.warnings.push('PayPal business_id seems too short - verify it is correct')
    }

    // Validate currency
    if (!paypal.currency || typeof paypal.currency !== 'string') {
      validationResults.warnings.push('PayPal currency missing - using default USD')
      processedContent.paypal.currency = 'USD'
    } else if (paypal.currency.length !== 3) {
      validationResults.warnings.push('PayPal currency should be 3-letter code (e.g., USD, EUR)')
    }

    // Validate amounts
    if (!paypal.amounts || !Array.isArray(paypal.amounts)) {
      validationResults.warnings.push('PayPal amounts missing or invalid - using defaults')
      processedContent.paypal.amounts = [10, 25, 50, 100, 250]
    } else {
      const validAmounts = paypal.amounts.filter(amount =>
        typeof amount === 'number' && amount > 0 && amount <= 10000
      )

      if (validAmounts.length !== paypal.amounts.length) {
        validationResults.warnings.push('Some PayPal amounts are invalid - filtered out invalid values')
        processedContent.paypal.amounts = validAmounts
      }

      if (validAmounts.length === 0) {
        validationResults.warnings.push('No valid PayPal amounts - using defaults')
        processedContent.paypal.amounts = [10, 25, 50, 100, 250]
      }
    }
  }

  /**
   * Validate image references
   * @param {Object} images - Images configuration object
   * @param {Object} validationResults - Validation results object
   */
  async validateImages (images, validationResults) {
    const { processedContent } = validationResults

    processedContent.images = processedContent.images || {}

    for (const [imageName, imageConfig] of Object.entries(images)) {
      if (typeof imageConfig === 'string') {
        // Simple URL string
        const isValid = await this.validateImageUrl(imageConfig)
        if (!isValid) {
          validationResults.warnings.push(`Image ${imageName} URL may be invalid: ${imageConfig}`)
        }
      } else if (typeof imageConfig === 'object') {
        // Complex image configuration
        if (imageConfig.src) {
          const isValid = await this.validateImageUrl(imageConfig.src)
          if (!isValid) {
            validationResults.warnings.push(`Image ${imageName} src may be invalid: ${imageConfig.src}`)
          }
        }

        // Validate alt text
        if (!imageConfig.alt || typeof imageConfig.alt !== 'string') {
          validationResults.warnings.push(`Image ${imageName} missing alt text - accessibility issue`)
          processedContent.images[imageName] = processedContent.images[imageName] || {}
          processedContent.images[imageName].alt = `Image: ${imageName}`
        }

        // Validate responsive sources
        if (imageConfig.sources && Array.isArray(imageConfig.sources)) {
          for (const source of imageConfig.sources) {
            if (source.src) {
              const isValid = await this.validateImageUrl(source.src)
              if (!isValid) {
                validationResults.warnings.push(`Image ${imageName} responsive source may be invalid: ${source.src}`)
              }
            }
          }
        }
      }
    }
  }

  /**
   * Apply content length management
   * @param {Object} content - Content object to process
   * @param {Object} validationResults - Validation results object
   */
  applyContentLengthManagement (content, validationResults) {
    // Truncate site content if too long
    if (content.site) {
      if (content.site.title && content.site.title.length > this.maxContentLengths.title) {
        content.site.title = this.truncateWithEllipsis(content.site.title, this.maxContentLengths.title)
        validationResults.warnings.push(`Site title truncated to ${this.maxContentLengths.title} characters`)
      }

      if (content.site.tagline && content.site.tagline.length > this.maxContentLengths.tagline) {
        content.site.tagline = this.truncateWithEllipsis(content.site.tagline, this.maxContentLengths.tagline)
        validationResults.warnings.push(`Site tagline truncated to ${this.maxContentLengths.tagline} characters`)
      }

      if (content.site.description && content.site.description.length > this.maxContentLengths.description) {
        content.site.description = this.truncateWithEllipsis(content.site.description, this.maxContentLengths.description)
        validationResults.warnings.push(`Site description truncated to ${this.maxContentLengths.description} characters`)
      }
    }

    // Truncate tab content if too long
    if (content.tabs) {
      for (const [tabName, tab] of Object.entries(content.tabs)) {
        if (tab.title && tab.title.length > this.maxContentLengths.shortText) {
          tab.title = this.truncateWithEllipsis(tab.title, this.maxContentLengths.shortText)
          validationResults.warnings.push(`Tab ${tabName} title truncated to ${this.maxContentLengths.shortText} characters`)
        }

        if (tab.content && tab.content.length > this.maxContentLengths.tabContent) {
          tab.content = this.truncateWithEllipsis(tab.content, this.maxContentLengths.tabContent)
          validationResults.warnings.push(`Tab ${tabName} content truncated to ${this.maxContentLengths.tabContent} characters`)
        }
      }
    }
  }

  /**
   * Validate image URL
   * @param {string} url - Image URL to validate
   * @returns {boolean} True if URL appears valid
   */
  async validateImageUrl (url) {
    try {
      // Basic URL validation
      const validUrl = new URL(url)
      // URL is valid if we reach here
      validUrl.toString() // Use the URL to avoid unused variable warning

      // Check file extension
      const extension = path.extname(url).toLowerCase().replace('.', '')
      if (extension && !this.supportedImageFormats.includes(extension)) {
        return false
      }

      // For local files, check if they exist
      if (!url.startsWith('http') && !url.startsWith('//')) {
        try {
          const imagePath = path.join(__dirname, '../../frontend', url.replace(/^\//, ''))
          await fs.access(imagePath)
          return true
        } catch {
          return false
        }
      }

      return true
    } catch {
      return false
    }
  }

  /**
   * Check if string contains HTML tags
   * @param {string} str - String to check
   * @returns {boolean} True if contains HTML
   */
  containsHTML (str) {
    return /<[^>]*>/g.test(str)
  }

  /**
   * Strip HTML tags from string
   * @param {string} str - String to process
   * @returns {string} String with HTML tags removed
   */
  stripHTML (str) {
    return str.replace(/<[^>]*>/g, '')
  }

  /**
   * Truncate string with ellipsis
   * @param {string} str - String to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated string
   */
  truncateWithEllipsis (str, maxLength) {
    if (str.length <= maxLength) return str
    return str.substring(0, maxLength - 3) + '...'
  }

  /**
   * Capitalize first letter of string
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  capitalizeFirst (str) {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  /**
   * Get content statistics
   * @param {Object} content - Content configuration
   * @returns {Object} Content statistics
   */
  getContentStatistics (content) {
    const stats = {
      totalCharacters: 0,
      totalWords: 0,
      tabCount: 0,
      imageCount: 0,
      warnings: 0,
      contentByType: {}
    }

    if (content.site) {
      const siteText = [content.site.title, content.site.tagline, content.site.description]
        .filter(Boolean)
        .join(' ')

      stats.totalCharacters += siteText.length
      stats.totalWords += this.countWords(siteText)
      stats.contentByType.site = {
        characters: siteText.length,
        words: this.countWords(siteText)
      }
    }

    if (content.tabs) {
      stats.tabCount = Object.keys(content.tabs).length

      for (const [tabName, tab] of Object.entries(content.tabs)) {
        const tabText = [tab.title, tab.content].filter(Boolean).join(' ')
        stats.totalCharacters += tabText.length
        stats.totalWords += this.countWords(tabText)

        stats.contentByType[`tab_${tabName}`] = {
          characters: tabText.length,
          words: this.countWords(tabText)
        }
      }
    }

    if (content.images) {
      stats.imageCount = Object.keys(content.images).length
    }

    return stats
  }

  /**
   * Count words in text
   * @param {string} text - Text to count words in
   * @returns {number} Word count
   */
  countWords (text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length
  }
}

module.exports = ContentManager
