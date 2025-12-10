/**
 * Statistics Display Engine
 * Handles fetching, formatting, and displaying dynamic statistics
 */
class StatisticsEngine {
  constructor (options = {}) {
    this.apiEndpoint = options.apiEndpoint || '/api/statistics'
    this.pollInterval = options.pollInterval || 30000 // 30 seconds
    this.retryAttempts = options.retryAttempts || 3
    this.retryDelay = options.retryDelay || 1000

    this.currentStats = null
    this.pollTimer = null
    this.isPolling = false
    this.retryCount = 0

    // Bind methods to preserve context
    this.fetchStatistics = this.fetchStatistics.bind(this)
    this.updateDisplay = this.updateDisplay.bind(this)
    this.handleError = this.handleError.bind(this)
  }

  /**
   * Initialize the statistics engine
   */
  async initialize () {
    try {
      // Initial fetch
      await this.fetchStatistics()

      // Start polling
      this.startPolling()

      console.log('Statistics engine initialized successfully')
    } catch (error) {
      console.error('Failed to initialize statistics engine:', error)
      this.handleError(error)
    }
  }

  /**
   * Start polling for statistics updates
   */
  startPolling () {
    if (this.isPolling) return

    this.isPolling = true
    this.pollTimer = setInterval(async () => {
      try {
        await this.fetchStatistics()
        this.retryCount = 0 // Reset retry count on success
      } catch (error) {
        console.error('Error during polling:', error)
        this.handleError(error)
      }
    }, this.pollInterval)

    console.log(`Started polling statistics every ${this.pollInterval}ms`)
  }

  /**
   * Stop polling for statistics updates
   */
  stopPolling () {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    this.isPolling = false
    console.log('Stopped polling statistics')
  }

  /**
   * Fetch statistics from the API
   */
  async fetchStatistics () {
    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'API returned unsuccessful response')
      }

      // Update current statistics
      this.currentStats = data.data

      // Update the display
      this.updateDisplay()

      return this.currentStats
    } catch (error) {
      console.error('Failed to fetch statistics:', error)
      throw error
    }
  }

  /**
   * Update the statistics display in the DOM
   */
  updateDisplay () {
    if (!this.currentStats || !this.currentStats.statistics) {
      console.warn('No statistics data available for display')
      return
    }

    const stats = this.currentStats.statistics

    // Update each statistic
    Object.entries(stats).forEach(([key, statData]) => {
      this.updateStatisticElement(key, statData)
    })

    // Update last updated timestamp
    this.updateLastUpdated()
  }

  /**
   * Update a specific statistic element in the DOM
   * @param {string} key - The statistic key (e.g., 'trees_planted')
   * @param {Object} statData - The statistic data object
   */
  updateStatisticElement (key, statData) {
    // Find the statistic container by data attribute or class
    const container = document.querySelector(`[data-stat="${key}"]`) ||
                     document.querySelector(`.stat-${key}`) ||
                     this.findStatisticByLabel(statData.label)

    if (!container) {
      console.warn(`No container found for statistic: ${key}`)
      return
    }

    // Format the value
    const formattedValue = this.formatStatisticValue(statData.value, statData.format)

    // Update the value element
    const valueElement = container.querySelector('.stat-value') ||
                        container.querySelector('.text-3xl') ||
                        container.querySelector('[data-stat-value]')

    if (valueElement) {
      // Animate the change if the value is different
      const currentText = valueElement.textContent.trim()
      if (currentText !== formattedValue) {
        this.animateValueChange(valueElement, formattedValue)
      }
    }

    // Update the label if needed
    const labelElement = container.querySelector('.stat-label') ||
                        container.querySelector('h3') ||
                        container.querySelector('[data-stat-label]')

    if (labelElement && statData.label) {
      labelElement.textContent = statData.label
    }

    // Update the icon if needed
    const iconElement = container.querySelector('.material-symbols-outlined') ||
                       container.querySelector('[data-stat-icon]')

    if (iconElement && statData.icon) {
      iconElement.textContent = statData.icon
    }
  }

  /**
   * Find a statistic container by its label text
   * @param {string} label - The label to search for
   * @returns {Element|null} The container element or null
   */
  findStatisticByLabel (label) {
    const elements = document.querySelectorAll('h3, .stat-label, [data-stat-label]')

    for (const element of elements) {
      if (element.textContent.trim() === label) {
        // Return the closest container (parent with stat styling)
        return element.closest('.bg-white\\/50, .stat-container, [data-stat]') ||
               element.closest('div')
      }
    }

    return null
  }

  /**
   * Format a statistic value based on its format type
   * @param {*} value - The raw value
   * @param {string} format - The format type
   * @returns {string} The formatted value
   */
  formatStatisticValue (value, format) {
    if (value === null || value === undefined) {
      return '0'
    }

    switch (format) {
      case 'number_with_suffix':
        return this.formatNumberWithSuffix(value)

      case 'number_with_plus':
        return this.formatNumberWithPlus(value)

      case 'number_with_separators':
        return this.formatNumberWithSeparators(value)

      case 'text':
        return String(value)

      default:
        // Default to number formatting if it's a number
        if (typeof value === 'number') {
          return this.formatNumberWithSeparators(value)
        }
        return String(value)
    }
  }

  /**
   * Format number with suffix (K, M, B)
   * @param {number} value - The number to format
   * @returns {string} Formatted number with suffix
   */
  formatNumberWithSuffix (value) {
    const num = Number(value)
    if (isNaN(num)) return String(value)

    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B'
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
    }
    return this.formatNumberWithSeparators(num)
  }

  /**
   * Format number with plus sign and separators
   * @param {number} value - The number to format
   * @returns {string} Formatted number with plus
   */
  formatNumberWithPlus (value) {
    const num = Number(value)
    if (isNaN(num)) return String(value)

    const formatted = this.formatNumberWithSeparators(num)
    return num > 0 ? `${formatted}+` : formatted
  }

  /**
   * Format number with thousand separators
   * @param {number} value - The number to format
   * @returns {string} Formatted number with separators
   */
  formatNumberWithSeparators (value) {
    const num = Number(value)
    if (isNaN(num)) return String(value)

    return num.toLocaleString('en-US')
  }

  /**
   * Animate value change with smooth transition
   * @param {Element} element - The element to animate
   * @param {string} newValue - The new value to display
   */
  animateValueChange (element, newValue) {
    // Add animation class
    element.classList.add('stat-updating')

    // Brief fade effect
    element.style.opacity = '0.7'
    element.style.transform = 'scale(0.98)'

    setTimeout(() => {
      element.textContent = newValue
      element.style.opacity = '1'
      element.style.transform = 'scale(1)'
      element.classList.remove('stat-updating')
    }, 150)
  }

  /**
   * Update the last updated timestamp display
   */
  updateLastUpdated () {
    if (!this.currentStats || !this.currentStats.last_updated) return

    const timestampElements = document.querySelectorAll('[data-last-updated], .last-updated')
    const formattedTime = this.formatTimestamp(this.currentStats.last_updated)

    timestampElements.forEach(element => {
      element.textContent = `Last updated: ${formattedTime}`
      element.title = this.currentStats.last_updated // Full timestamp in tooltip
    })
  }

  /**
   * Format timestamp for display
   * @param {string} timestamp - ISO timestamp string
   * @returns {string} Formatted timestamp
   */
  formatTimestamp (timestamp) {
    try {
      const date = new Date(timestamp)
      const now = new Date()
      const diffMs = now - date
      const diffMins = Math.floor(diffMs / 60000)

      if (diffMins < 1) return 'just now'
      if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`

      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (error) {
      console.error('Error formatting timestamp:', error)
      return 'unknown'
    }
  }

  /**
   * Handle errors with retry logic
   * @param {Error} error - The error to handle
   */
  handleError (error) {
    console.error('Statistics engine error:', error)

    this.retryCount++

    if (this.retryCount <= this.retryAttempts) {
      console.log(`Retrying in ${this.retryDelay}ms (attempt ${this.retryCount}/${this.retryAttempts})`)

      setTimeout(async () => {
        try {
          await this.fetchStatistics()
          this.retryCount = 0 // Reset on success
        } catch (retryError) {
          this.handleError(retryError)
        }
      }, this.retryDelay * this.retryCount) // Exponential backoff
    } else {
      console.error('Max retry attempts reached, using fallback values')
      this.showFallbackValues()
      this.retryCount = 0 // Reset for next polling cycle
    }
  }

  /**
   * Show fallback values when API is unavailable
   */
  showFallbackValues () {
    const fallbackStats = {
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
      last_updated: new Date().toISOString()
    }

    this.currentStats = fallbackStats
    this.updateDisplay()

    // Show error indicator
    this.showErrorIndicator()
  }

  /**
   * Show error indicator in the UI
   */
  showErrorIndicator () {
    const indicators = document.querySelectorAll('[data-connection-status]')
    indicators.forEach(indicator => {
      indicator.textContent = 'Connection Error'
      indicator.className = 'text-red-500 text-xs'
    })
  }

  /**
   * Get current statistics data
   * @returns {Object|null} Current statistics or null
   */
  getCurrentStats () {
    return this.currentStats
  }

  /**
   * Manually refresh statistics
   */
  async refresh () {
    try {
      await this.fetchStatistics()
      console.log('Statistics refreshed manually')
    } catch (error) {
      console.error('Failed to refresh statistics:', error)
      this.handleError(error)
    }
  }

  /**
   * Increment statistics based on donation amount
   * @param {number} donationAmount - The donation amount in dollars
   */
  async incrementStatistics (donationAmount) {
    if (!donationAmount || donationAmount <= 0) {
      console.warn('Invalid donation amount:', donationAmount)
      return
    }

    try {
      // Calculate increments based on donation amount
      const increments = this.calculateStatisticsIncrements(donationAmount)

      // Send increment request to backend
      const response = await fetch('/api/statistics/increment', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          donation_amount: donationAmount,
          increments
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to increment statistics')
      }

      // Update local statistics with new values
      if (data.data) {
        this.currentStats = data.data
        this.updateDisplay()
      }

      console.log(`Statistics incremented for donation of $${donationAmount}`)
      return data.data
    } catch (error) {
      console.error('Failed to increment statistics:', error)
      throw error
    }
  }

  /**
   * Calculate statistics increments based on donation amount
   * @param {number} donationAmount - The donation amount in dollars
   * @returns {Object} Increment values for each statistic
   */
  calculateStatisticsIncrements (donationAmount) {
    // Base conversion rates (can be configured)
    const TREES_PER_DOLLAR = 2 // $1 = 2 trees planted
    const HECTARES_PER_HUNDRED_DOLLARS = 0.1 // $100 = 0.1 hectares

    const treesIncrement = Math.floor(donationAmount * TREES_PER_DOLLAR)
    const hectaresIncrement = Math.floor((donationAmount / 100) * HECTARES_PER_HUNDRED_DOLLARS * 100) / 100 // Round to 2 decimals

    return {
      trees_planted: treesIncrement,
      hectares_restored: hectaresIncrement,
      // Global impact doesn't increment numerically, it's a text field
      global_impact: null
    }
  }

  /**
   * Handle PayPal success callback
   * @param {Object} paypalData - PayPal transaction data
   */
  async handlePayPalSuccess (paypalData) {
    try {
      // Extract donation amount from PayPal data
      const donationAmount = this.extractDonationAmount(paypalData)

      if (donationAmount > 0) {
        await this.incrementStatistics(donationAmount)

        // Trigger a refresh to get updated statistics
        await this.fetchStatistics()

        console.log('PayPal donation processed successfully:', {
          amount: donationAmount,
          transactionId: paypalData.transactionID || paypalData.orderID
        })
      }
    } catch (error) {
      console.error('Error processing PayPal donation:', error)
      // Don't throw error to avoid breaking PayPal flow
    }
  }

  /**
   * Extract donation amount from PayPal transaction data
   * @param {Object} paypalData - PayPal transaction data
   * @returns {number} Donation amount in dollars
   */
  extractDonationAmount (paypalData) {
    // PayPal data structure can vary, try multiple possible locations
    if (paypalData.purchase_units && paypalData.purchase_units[0]) {
      const amount = paypalData.purchase_units[0].amount
      if (amount && amount.value) {
        return parseFloat(amount.value)
      }
    }

    if (paypalData.amount) {
      return parseFloat(paypalData.amount)
    }

    if (paypalData.value) {
      return parseFloat(paypalData.value)
    }

    console.warn('Could not extract donation amount from PayPal data:', paypalData)
    return 0
  }

  /**
   * Clean up resources
   */
  destroy () {
    this.stopPolling()
    this.currentStats = null
    console.log('Statistics engine destroyed')
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StatisticsEngine
} else if (typeof window !== 'undefined') {
  window.StatisticsEngine = StatisticsEngine
}
