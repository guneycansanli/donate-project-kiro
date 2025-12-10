// Main JavaScript entry point

/**
 * Tab Navigation System
 * Manages tab switching, keyboard navigation, and content loading
 */
class TabNavigation {
  constructor () {
    this.currentTab = 'home'
    this.tabs = ['home', 'about', 'impact', 'donate']
    this.isTransitioning = false
  }

  async init () {
    this.createTabStructure()
    this.bindEvents()
    await this.loadDonationConfiguration()
    this.setupPayPalUrls()
    this.showTab('home')
  }

  createTabStructure () {
    // Find the header navigation and update it with tab functionality
    const headerNav = document.querySelector('header .hidden.sm\\:flex .flex.items-center.gap-9')
    if (headerNav) {
      headerNav.innerHTML = `
                <button class="tab-button text-gray-800 dark:text-gray-200 text-sm font-medium leading-normal hover:text-primary transition-colors" 
                        data-tab="home" role="tab" aria-selected="true" tabindex="0">
                    Home
                </button>
                <button class="tab-button text-gray-800 dark:text-gray-200 text-sm font-medium leading-normal hover:text-primary transition-colors" 
                        data-tab="about" role="tab" aria-selected="false" tabindex="-1">
                    About Us
                </button>
                <button class="tab-button text-gray-800 dark:text-gray-200 text-sm font-medium leading-normal hover:text-primary transition-colors" 
                        data-tab="impact" role="tab" aria-selected="false" tabindex="-1">
                    Impact
                </button>
                <button class="tab-button text-gray-800 dark:text-gray-200 text-sm font-medium leading-normal hover:text-primary transition-colors" 
                        data-tab="donate" role="tab" aria-selected="false" tabindex="-1">
                    Donate
                </button>
            `
    }

    // Wrap main content in tab panels
    const main = document.querySelector('main')
    if (main) {
      const existingContent = main.innerHTML
      main.innerHTML = `
                <div class="tab-content-container" role="tabpanel">
                    <div class="tab-loading hidden">
                        <div class="flex items-center justify-center py-12">
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            <span class="ml-3 text-gray-600 dark:text-gray-400">Loading...</span>
                        </div>
                    </div>
                    
                    <div id="tab-home" class="tab-panel active" role="tabpanel" aria-labelledby="tab-home-button">
                        ${existingContent}
                    </div>
                    
                    <div id="tab-about" class="tab-panel hidden" role="tabpanel" aria-labelledby="tab-about-button">
                        <div class="py-12 sm:py-16">
                            <div class="px-4 max-w-4xl mx-auto">
                                <h1 class="text-gray-900 dark:text-white text-4xl font-bold leading-tight tracking-[-0.015em] pb-6">About Give Green, Live Clean</h1>
                                <div class="prose prose-lg max-w-none text-gray-700 dark:text-gray-300">
                                    <p class="text-lg leading-relaxed mb-6">
                                        Give Green, Live Clean is a global environmental initiative dedicated to reforestation and ecosystem restoration. 
                                        Founded on the principle that every individual can make a meaningful impact on our planet's future.
                                    </p>
                                    <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">Our Mission</h2>
                                    <p class="leading-relaxed mb-6">
                                        We believe in the power of collective action to restore our planet's forests and create sustainable ecosystems 
                                        for future generations. Through strategic partnerships with local communities and environmental organizations, 
                                        we ensure every donation directly contributes to meaningful environmental restoration.
                                    </p>
                                    <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">Our Approach</h2>
                                    <ul class="list-disc pl-6 space-y-2 mb-6">
                                        <li>Community-based reforestation projects</li>
                                        <li>Scientific monitoring and ecosystem assessment</li>
                                        <li>Transparent reporting and impact tracking</li>
                                        <li>Long-term sustainability partnerships</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div id="tab-impact" class="tab-panel hidden" role="tabpanel" aria-labelledby="tab-impact-button">
                        <div class="py-12 sm:py-16">
                            <div class="px-4 max-w-4xl mx-auto">
                                <h1 class="text-gray-900 dark:text-white text-4xl font-bold leading-tight tracking-[-0.015em] pb-6">Our Environmental Impact</h1>
                                
                                <!-- Statistics Section -->
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12" id="statistics-container">
                                    <div class="bg-white/50 dark:bg-black/20 rounded-xl p-6 border border-gray-200/80 dark:border-gray-700/60" data-stat="trees_planted">
                                        <div class="flex items-center gap-3 mb-4">
                                            <span class="material-symbols-outlined text-primary text-3xl" data-stat-icon>park</span>
                                            <h3 class="text-lg font-semibold text-gray-900 dark:text-white stat-label" data-stat-label>Trees Planted</h3>
                                        </div>
                                        <p class="text-3xl font-bold text-primary mb-2 stat-value" data-stat-value>150,000+</p>
                                        <p class="text-sm text-gray-600 dark:text-gray-400">Across 15 countries worldwide</p>
                                    </div>
                                    
                                    <div class="bg-white/50 dark:bg-black/20 rounded-xl p-6 border border-gray-200/80 dark:border-gray-700/60" data-stat="hectares_restored">
                                        <div class="flex items-center gap-3 mb-4">
                                            <span class="material-symbols-outlined text-primary text-3xl" data-stat-icon>landscape</span>
                                            <h3 class="text-lg font-semibold text-gray-900 dark:text-white stat-label" data-stat-label>Hectares Restored</h3>
                                        </div>
                                        <p class="text-3xl font-bold text-primary mb-2 stat-value" data-stat-value>75+</p>
                                        <p class="text-sm text-gray-600 dark:text-gray-400">Degraded ecosystems revitalized</p>
                                    </div>
                                    
                                    <div class="bg-white/50 dark:bg-black/20 rounded-xl p-6 border border-gray-200/80 dark:border-gray-700/60" data-stat="global_impact">
                                        <div class="flex items-center gap-3 mb-4">
                                            <span class="material-symbols-outlined text-primary text-3xl" data-stat-icon>public</span>
                                            <h3 class="text-lg font-semibold text-gray-900 dark:text-white stat-label" data-stat-label>Global Impact</h3>
                                        </div>
                                        <p class="text-3xl font-bold text-primary mb-2 stat-value" data-stat-value>Worldwide</p>
                                        <p class="text-sm text-gray-600 dark:text-gray-400">Making a difference globally</p>
                                    </div>
                                </div>
                                
                                <!-- Statistics Status -->
                                <div class="text-center mb-8">
                                    <p class="text-xs text-gray-500 dark:text-gray-400" data-last-updated>Last updated: Loading...</p>
                                    <p class="text-xs text-gray-500 dark:text-gray-400" data-connection-status></p>
                                </div>

                                <div class="prose prose-lg max-w-none text-gray-700 dark:text-gray-300">
                                    <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">Real Impact Stories</h2>
                                    <p class="leading-relaxed mb-6">
                                        Every tree planted through Give Green, Live Clean contributes to measurable environmental restoration. 
                                        Our projects focus on biodiversity recovery, soil stabilization, and community empowerment.
                                    </p>
                                    
                                    <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">Project Highlights</h3>
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                        <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                                            <h4 class="font-semibold text-gray-900 dark:text-white mb-2">Amazon Restoration Initiative</h4>
                                            <p class="text-sm text-gray-600 dark:text-gray-400">25,000 native trees planted in partnership with indigenous communities</p>
                                        </div>
                                        <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                                            <h4 class="font-semibold text-gray-900 dark:text-white mb-2">African Savanna Recovery</h4>
                                            <p class="text-sm text-gray-600 dark:text-gray-400">15 hectares of degraded land transformed into thriving ecosystem</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div id="tab-donate" class="tab-panel hidden" role="tabpanel" aria-labelledby="tab-donate-button">
                        <div class="py-12 sm:py-16">
                            <div class="px-4 max-w-4xl mx-auto text-center">
                                <h1 class="text-gray-900 dark:text-white text-4xl font-bold leading-tight tracking-[-0.015em] pb-6">Support Our Mission</h1>
                                <p class="text-lg text-gray-700 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
                                    Your donation directly funds tree planting, ecosystem restoration, and community empowerment projects worldwide. 
                                    Every dollar makes a measurable difference.
                                </p>
                                
                                <!-- Donation Amount Selection -->
                                <div class="mb-8">
                                    <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Choose Your Impact</h2>
                                    <div class="grid grid-cols-2 md:grid-cols-5 gap-3 max-w-2xl mx-auto mb-6">
                                        <button class="donation-amount bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary transition-colors" data-amount="10">
                                            <div class="text-lg font-bold text-gray-900 dark:text-white">$10</div>
                                            <div class="text-xs text-gray-600 dark:text-gray-400">Plants 2 trees</div>
                                        </button>
                                        <button class="donation-amount bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary transition-colors" data-amount="25">
                                            <div class="text-lg font-bold text-gray-900 dark:text-white">$25</div>
                                            <div class="text-xs text-gray-600 dark:text-gray-400">Plants 5 trees</div>
                                        </button>
                                        <button class="donation-amount bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary transition-colors" data-amount="50">
                                            <div class="text-lg font-bold text-gray-900 dark:text-white">$50</div>
                                            <div class="text-xs text-gray-600 dark:text-gray-400">Plants 10 trees</div>
                                        </button>
                                        <button class="donation-amount bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary transition-colors" data-amount="100">
                                            <div class="text-lg font-bold text-gray-900 dark:text-white">$100</div>
                                            <div class="text-xs text-gray-600 dark:text-gray-400">Plants 20 trees</div>
                                        </button>
                                        <button class="donation-amount bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary transition-colors" data-amount="250">
                                            <div class="text-lg font-bold text-gray-900 dark:text-white">$250</div>
                                            <div class="text-xs text-gray-600 dark:text-gray-400">Plants 50 trees</div>
                                        </button>
                                    </div>
                                    
                                    <div class="mb-6">
                                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Custom Amount</label>
                                        <div class="relative">
                                            <input type="number" id="custom-amount" class="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary" placeholder="$" min="1" max="10000" step="0.01">
                                            <div class="absolute left-0 top-full mt-1 text-xs text-red-500 hidden" id="custom-amount-error">
                                                Please enter an amount between $1 and $10,000
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- PayPal Integration -->
                                <div class="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 max-w-md mx-auto">
                                    <div class="flex items-center justify-center mb-4">
                                        <span class="material-symbols-outlined text-primary text-4xl">payment</span>
                                    </div>
                                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Secure PayPal Donation</h3>
                                    
                                    <!-- PayPal Form -->
                                    <form action="https://www.paypal.com/donate" method="post" target="_top" id="paypal-donation-form">
                                        <input type="hidden" name="business" value="73PLJSAMMTSCW" />
                                        <input type="hidden" name="no_recurring" value="0" />
                                        <input type="hidden" name="item_name" value="Environmental Restoration Donation" />
                                        <input type="hidden" name="currency_code" value="USD" />
                                        <input type="hidden" name="amount" value="" id="paypal-amount" />
                                        <input type="hidden" name="return" value="" id="paypal-return-url" />
                                        <input type="hidden" name="cancel_return" value="" id="paypal-cancel-url" />
                                        <input type="hidden" name="notify_url" value="" id="paypal-notify-url" />
                                        
                                        <button type="submit" class="w-full bg-primary text-gray-900 font-bold py-3 px-6 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed" id="paypal-submit-btn" disabled>
                                            <span class="flex items-center justify-center gap-2">
                                                <span>Donate with PayPal</span>
                                                <span class="material-symbols-outlined text-lg">arrow_forward</span>
                                            </span>
                                        </button>
                                    </form>
                                    
                                    <div class="flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-3">
                                        <span class="material-symbols-outlined text-sm">lock</span>
                                        <span>Secure & Encrypted</span>
                                    </div>
                                    
                                    <!-- Selected Amount Display -->
                                    <div class="mt-4 text-center">
                                        <p class="text-sm text-gray-600 dark:text-gray-400" id="selected-amount-display">
                                            Please select a donation amount above
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `
    }
  }

  bindEvents () {
    // Tab button clicks
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-button')) {
        e.preventDefault()
        const tabName = e.target.dataset.tab
        this.showTab(tabName)
      }
    })

    // Mobile navigation events
    this.bindMobileNavigation()

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      const activeTab = document.querySelector('.tab-button[aria-selected="true"]')
      if (!activeTab) return

      let newTab = null
      const currentIndex = this.tabs.indexOf(this.currentTab)

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          newTab = this.tabs[currentIndex > 0 ? currentIndex - 1 : this.tabs.length - 1]
          break
        case 'ArrowRight':
          e.preventDefault()
          newTab = this.tabs[currentIndex < this.tabs.length - 1 ? currentIndex + 1 : 0]
          break
        case 'Enter':
        case ' ':
          if (e.target.classList.contains('tab-button')) {
            e.preventDefault()
            this.showTab(e.target.dataset.tab)
          }
          break
        case 'Home':
          e.preventDefault()
          newTab = this.tabs[0]
          break
        case 'End':
          e.preventDefault()
          newTab = this.tabs[this.tabs.length - 1]
          break
      }

      if (newTab) {
        this.showTab(newTab)
        document.querySelector(`[data-tab="${newTab}"]`).focus()
      }
    })

    // Donation amount selection
    document.addEventListener('click', (e) => {
      if (e.target.closest('.donation-amount')) {
        const button = e.target.closest('.donation-amount')
        const amount = parseFloat(button.dataset.amount)

        // Remove active state from all buttons
        document.querySelectorAll('.donation-amount').forEach(btn => {
          btn.classList.remove('border-primary', 'bg-primary/10')
        })

        // Add active state to clicked button
        button.classList.add('border-primary', 'bg-primary/10')

        // Clear custom amount
        const customInput = document.getElementById('custom-amount')
        if (customInput) customInput.value = ''

        // Update PayPal form and display
        this.updateDonationAmount(amount)
      }
    })

    // Custom amount input
    document.addEventListener('input', (e) => {
      if (e.target.id === 'custom-amount') {
        // Remove active state from preset amounts
        document.querySelectorAll('.donation-amount').forEach(btn => {
          btn.classList.remove('border-primary', 'bg-primary/10')
        })

        // Validate and update amount
        const amount = this.validateCustomAmount(e.target.value)
        if (amount > 0) {
          this.updateDonationAmount(amount)
        } else {
          this.clearDonationAmount()
        }
      }
    })

    // PayPal form submission
    document.addEventListener('submit', (e) => {
      if (e.target.id === 'paypal-donation-form') {
        const amount = document.getElementById('paypal-amount').value
        if (!amount || parseFloat(amount) <= 0) {
          e.preventDefault()
          alert('Please select a donation amount before proceeding.')
          return false
        }

        // Track donation attempt
        this.trackDonationAttempt(parseFloat(amount))
      }
    })
  }

  showTab (tabName) {
    if (this.isTransitioning || !this.tabs.includes(tabName)) return

    this.isTransitioning = true

    // Show loading state briefly for smooth transition
    this.showLoading()

    setTimeout(() => {
      // Update tab buttons
      document.querySelectorAll('.tab-button').forEach(button => {
        const isActive = button.dataset.tab === tabName
        button.setAttribute('aria-selected', isActive)
        button.setAttribute('tabindex', isActive ? '0' : '-1')

        if (isActive) {
          button.classList.add('text-primary')
          button.classList.remove('text-gray-800', 'dark:text-gray-200')
        } else {
          button.classList.remove('text-primary')
          button.classList.add('text-gray-800', 'dark:text-gray-200')
        }
      })

      // Update tab panels
      document.querySelectorAll('.tab-panel').forEach(panel => {
        if (panel.id === `tab-${tabName}`) {
          panel.classList.remove('hidden')
          panel.classList.add('active')
        } else {
          panel.classList.add('hidden')
          panel.classList.remove('active')
        }
      })

      this.currentTab = tabName
      this.hideLoading()
      this.isTransitioning = false

      // Update mobile navigation state
      this.updateMobileNavigation(tabName)

      // Process images in the newly shown tab
      if (window.imageOptimizer) {
        const activePanel = document.getElementById(`tab-${tabName}`)
        if (activePanel) {
          window.imageOptimizer.processNewImages(activePanel)
        }
      }

      // Update URL without page reload
      if (history.pushState) {
        const newUrl = tabName === 'home' ? '/' : `/#${tabName}`
        history.pushState({ tab: tabName }, '', newUrl)
      }
    }, 150) // Brief loading animation
  }

  showLoading () {
    const loading = document.querySelector('.tab-loading')
    if (loading) {
      loading.classList.remove('hidden')
    }
  }

  hideLoading () {
    const loading = document.querySelector('.tab-loading')
    if (loading) {
      loading.classList.add('hidden')
    }
  }

  // Handle browser back/forward buttons
  handlePopState (event) {
    const tab = event.state?.tab || this.getTabFromUrl()
    this.showTab(tab)
  }

  getTabFromUrl () {
    const hash = window.location.hash.substring(1)
    return this.tabs.includes(hash) ? hash : 'home'
  }

  /**
     * Update the donation amount in PayPal form and display
     * @param {number} amount - The donation amount in dollars
     */
  updateDonationAmount (amount) {
    if (!amount || amount <= 0) {
      this.clearDonationAmount()
      return
    }

    // Update PayPal form
    const paypalAmountInput = document.getElementById('paypal-amount')
    const paypalSubmitBtn = document.getElementById('paypal-submit-btn')
    const amountDisplay = document.getElementById('selected-amount-display')

    if (paypalAmountInput) {
      paypalAmountInput.value = amount.toFixed(2)
    }

    if (paypalSubmitBtn) {
      paypalSubmitBtn.disabled = false
      paypalSubmitBtn.classList.remove('opacity-50', 'cursor-not-allowed')
    }

    if (amountDisplay) {
      const treesPlanted = Math.floor(amount * 2) // $1 = 2 trees
      amountDisplay.innerHTML = `
                <span class="text-primary font-semibold">$${amount.toFixed(2)}</span> 
                <span class="text-gray-600 dark:text-gray-400">will plant approximately ${treesPlanted} trees</span>
            `
    }
  }

  /**
     * Clear the donation amount and disable PayPal form
     */
  clearDonationAmount () {
    const paypalAmountInput = document.getElementById('paypal-amount')
    const paypalSubmitBtn = document.getElementById('paypal-submit-btn')
    const amountDisplay = document.getElementById('selected-amount-display')

    if (paypalAmountInput) {
      paypalAmountInput.value = ''
    }

    if (paypalSubmitBtn) {
      paypalSubmitBtn.disabled = true
      paypalSubmitBtn.classList.add('opacity-50', 'cursor-not-allowed')
    }

    if (amountDisplay) {
      amountDisplay.textContent = 'Please select a donation amount above'
    }
  }

  /**
     * Validate custom donation amount input
     * @param {string} value - The input value to validate
     * @returns {number} The validated amount or 0 if invalid
     */
  validateCustomAmount (value) {
    const errorElement = document.getElementById('custom-amount-error')
    const inputElement = document.getElementById('custom-amount')

    // Remove any non-numeric characters except decimal point
    const cleanValue = value.replace(/[^0-9.]/g, '')

    // Parse as float
    const amount = parseFloat(cleanValue)

    // Hide error by default
    if (errorElement) {
      errorElement.classList.add('hidden')
    }
    if (inputElement) {
      inputElement.classList.remove('border-red-500')
    }

    // Validate range and format
    if (isNaN(amount) || amount <= 0) {
      if (value.trim() !== '') {
        this.showValidationError('Please enter a valid amount')
      }
      return 0
    }

    // Minimum donation of $1
    if (amount < 1) {
      this.showValidationError('Minimum donation is $1')
      return 0
    }

    // Maximum donation of $10,000 (reasonable limit)
    if (amount > 10000) {
      this.showValidationError('Maximum donation is $10,000')
      // Auto-correct to maximum
      if (inputElement) {
        inputElement.value = '10000'
      }
      return 10000
    }

    // Round to 2 decimal places
    return Math.round(amount * 100) / 100
  }

  /**
     * Show validation error for custom amount input
     * @param {string} message - The error message to display
     */
  showValidationError (message) {
    const errorElement = document.getElementById('custom-amount-error')
    const inputElement = document.getElementById('custom-amount')

    if (errorElement) {
      errorElement.textContent = message
      errorElement.classList.remove('hidden')
    }

    if (inputElement) {
      inputElement.classList.add('border-red-500')
    }
  }

  /**
     * Load donation configuration from content.yml
     */
  async loadDonationConfiguration () {
    try {
      const response = await fetch('/api/content')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data.paypal) {
          this.updateDonationAmounts(data.data.paypal.amounts || [10, 25, 50, 100, 250])
        }
      }
    } catch (error) {
      console.warn('Failed to load donation configuration, using defaults:', error)
      // Use default amounts if configuration fails to load
      this.updateDonationAmounts([10, 25, 50, 100, 250])
    }
  }

  /**
     * Update donation amount buttons based on configuration
     * @param {number[]} amounts - Array of donation amounts
     */
  updateDonationAmounts (amounts) {
    const container = document.querySelector('.grid.grid-cols-2.md\\:grid-cols-5')
    if (!container) return

    // Clear existing buttons
    container.innerHTML = ''

    // Create buttons for each amount
    amounts.forEach(amount => {
      const treesPlanted = Math.floor(amount * 2) // $1 = 2 trees
      const button = document.createElement('button')
      button.className = 'donation-amount bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary transition-colors focus:ring-2 focus:ring-primary focus:outline-none'
      button.dataset.amount = amount
      button.innerHTML = `
                <div class="text-lg font-bold text-gray-900 dark:text-white">$${amount}</div>
                <div class="text-xs text-gray-600 dark:text-gray-400">Plants ${treesPlanted} trees</div>
            `
      container.appendChild(button)
    })
  }

  /**
     * Track donation attempt for analytics
     * @param {number} amount - The donation amount
     */
  trackDonationAttempt (amount) {
    try {
      // Store donation attempt in localStorage for success page
      localStorage.setItem('pendingDonation', JSON.stringify({
        amount,
        timestamp: new Date().toISOString(),
        trees: Math.floor(amount * 2)
      }))

      console.log('Donation attempt tracked:', { amount })
    } catch (error) {
      console.warn('Failed to track donation attempt:', error)
    }
  }

  /**
     * Handle successful donation (called from success page or callback)
     * @param {Object} donationData - Donation details
     */
  async handleDonationSuccess (donationData) {
    try {
      // Delegate to donation handler if available
      if (window.donationHandler) {
        await window.donationHandler.handleDonationSuccess(donationData)
      } else {
        // Fallback implementation
        if (window.statisticsEngine && typeof window.statisticsEngine.incrementStatistics === 'function') {
          await window.statisticsEngine.incrementStatistics(donationData.amount)
        }
        localStorage.removeItem('pendingDonation')
        this.showDonationSuccessMessage(donationData)
      }

      console.log('Donation processed successfully:', donationData)
    } catch (error) {
      console.error('Error processing donation success:', error)
    }
  }

  /**
     * Show donation success message
     * @param {Object} donationData - Donation details
     */
  showDonationSuccessMessage (donationData) {
    // Create success notification
    const notification = document.createElement('div')
    notification.className = 'fixed top-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm'
    notification.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="material-symbols-outlined">check_circle</span>
                <div>
                    <h4 class="font-semibold">Thank you for your donation!</h4>
                    <p class="text-sm">$${donationData.amount} will plant ${donationData.trees} trees</p>
                </div>
            </div>
        `

    document.body.appendChild(notification)

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification)
      }
    }, 5000)
  }

  /**
     * Setup PayPal return URLs
     */
  setupPayPalUrls () {
    const baseUrl = window.location.origin

    const returnUrl = document.getElementById('paypal-return-url')
    const cancelUrl = document.getElementById('paypal-cancel-url')
    const notifyUrl = document.getElementById('paypal-notify-url')

    if (returnUrl) {
      returnUrl.value = `${baseUrl}/#donate?success=1`
    }

    if (cancelUrl) {
      cancelUrl.value = `${baseUrl}/#donate?cancelled=1`
    }

    if (notifyUrl) {
      notifyUrl.value = `${baseUrl}/api/paypal/ipn`
    }
  }

  /**
     * Show donation cancelled message
     */
  showDonationCancelledMessage () {
    const notification = document.createElement('div')
    notification.className = 'fixed top-4 right-4 bg-yellow-500 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm'
    notification.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="material-symbols-outlined">info</span>
                <div>
                    <h4 class="font-semibold">Donation Cancelled</h4>
                    <p class="text-sm">Your donation was cancelled. You can try again anytime.</p>
                </div>
            </div>
        `

    document.body.appendChild(notification)

    // Auto-remove after 4 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification)
      }
    }, 4000)
  }

  /**
     * Bind mobile navigation events
     */
  bindMobileNavigation () {
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle')
    const mobileMenu = document.getElementById('mobile-menu')
    const mobileMenuPanel = document.getElementById('mobile-menu-panel')
    const mobileMenuClose = document.getElementById('mobile-menu-close')

    if (!mobileMenuToggle || !mobileMenu || !mobileMenuPanel || !mobileMenuClose) {
      console.warn('Mobile navigation elements not found')
      return
    }

    // Toggle mobile menu
    mobileMenuToggle.addEventListener('click', (e) => {
      e.preventDefault()
      this.toggleMobileMenu(true)
    })

    // Close mobile menu
    mobileMenuClose.addEventListener('click', (e) => {
      e.preventDefault()
      this.toggleMobileMenu(false)
    })

    // Close menu when clicking backdrop
    mobileMenu.addEventListener('click', (e) => {
      if (e.target === mobileMenu) {
        this.toggleMobileMenu(false)
      }
    })

    // Handle mobile navigation item clicks
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('mobile-nav-item') || e.target.closest('.mobile-nav-item')) {
        e.preventDefault()
        const button = e.target.classList.contains('mobile-nav-item') ? e.target : e.target.closest('.mobile-nav-item')
        const tabName = button.dataset.tab

        if (tabName) {
          this.showTab(tabName)
          this.toggleMobileMenu(false)
        }
      }
    })

    // Handle escape key to close mobile menu
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isMobileMenuOpen()) {
        this.toggleMobileMenu(false)
      }
    })

    // Handle window resize to close mobile menu on desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 640 && this.isMobileMenuOpen()) {
        this.toggleMobileMenu(false)
      }
    })

    // Prevent body scroll when mobile menu is open
    this.setupMobileMenuScrollLock()
  }

  /**
     * Toggle mobile menu open/closed state
     * @param {boolean} open - Whether to open or close the menu
     */
  toggleMobileMenu (open) {
    const mobileMenu = document.getElementById('mobile-menu')
    const mobileMenuPanel = document.getElementById('mobile-menu-panel')
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle')
    const mobileMenuIcon = document.getElementById('mobile-menu-icon')

    if (!mobileMenu || !mobileMenuPanel || !mobileMenuToggle || !mobileMenuIcon) {
      return
    }

    if (open) {
      // Open menu
      mobileMenu.classList.remove('hidden')
      mobileMenu.setAttribute('aria-hidden', 'false')
      mobileMenuToggle.setAttribute('aria-expanded', 'true')
      mobileMenuIcon.textContent = 'close'

      // Trigger animation after display change
      requestAnimationFrame(() => {
        mobileMenuPanel.classList.add('open')
      })

      // Lock body scroll
      document.body.style.overflow = 'hidden'

      // Focus first menu item for accessibility
      const firstMenuItem = mobileMenuPanel.querySelector('.mobile-nav-item')
      if (firstMenuItem) {
        firstMenuItem.focus()
      }
    } else {
      // Close menu
      mobileMenuPanel.classList.remove('open')
      mobileMenuToggle.setAttribute('aria-expanded', 'false')
      mobileMenuIcon.textContent = 'menu'

      // Hide menu after animation
      setTimeout(() => {
        mobileMenu.classList.add('hidden')
        mobileMenu.setAttribute('aria-hidden', 'true')
      }, 300)

      // Unlock body scroll
      document.body.style.overflow = ''

      // Return focus to toggle button
      mobileMenuToggle.focus()
    }
  }

  /**
     * Check if mobile menu is currently open
     * @returns {boolean} True if mobile menu is open
     */
  isMobileMenuOpen () {
    const mobileMenu = document.getElementById('mobile-menu')
    return mobileMenu && !mobileMenu.classList.contains('hidden')
  }

  /**
     * Setup scroll lock functionality for mobile menu
     */
  setupMobileMenuScrollLock () {
    let scrollPosition = 0

    // Store scroll position when menu opens
    document.addEventListener('click', (e) => {
      if (e.target.id === 'mobile-menu-toggle') {
        scrollPosition = window.pageYOffset
      }
    })

    // Restore scroll position when menu closes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.target.id === 'mobile-menu' && mutation.attributeName === 'class') {
          const isHidden = mutation.target.classList.contains('hidden')
          if (isHidden && scrollPosition > 0) {
            window.scrollTo(0, scrollPosition)
            scrollPosition = 0
          }
        }
      })
    })

    const mobileMenu = document.getElementById('mobile-menu')
    if (mobileMenu) {
      observer.observe(mobileMenu, { attributes: true, attributeFilter: ['class'] })
    }
  }

  /**
     * Update mobile navigation active state
     * @param {string} activeTab - The currently active tab
     */
  updateMobileNavigation (activeTab) {
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
      const isActive = item.dataset.tab === activeTab

      if (isActive) {
        item.classList.add('bg-primary/10', 'text-primary')
        item.classList.remove('text-gray-800', 'dark:text-gray-200')
      } else {
        item.classList.remove('bg-primary/10', 'text-primary')
        item.classList.add('text-gray-800', 'dark:text-gray-200')
      }
    })
  }
}

// Initialize tab navigation and statistics engine when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const tabNav = new TabNavigation()
  await tabNav.init()

  // Make tab navigation globally accessible
  window.tabNavigation = tabNav

  // Initialize image optimizer
  let imageOptimizer = null
  try {
    if (typeof ImageOptimizer !== 'undefined') {
      imageOptimizer = new ImageOptimizer({
        lazyLoadThreshold: 100,
        retryAttempts: 3,
        retryDelay: 1000
      })
      await imageOptimizer.initialize()
      window.imageOptimizer = imageOptimizer
    } else {
      console.warn('ImageOptimizer not available, loading dynamically...')
      // Dynamically load image optimizer
      const script = document.createElement('script')
      script.src = '/js/imageOptimizer.js'
      script.onload = async () => {
        imageOptimizer = new ImageOptimizer({
          lazyLoadThreshold: 100,
          retryAttempts: 3,
          retryDelay: 1000
        })
        await imageOptimizer.initialize()
        window.imageOptimizer = imageOptimizer
      }
      document.head.appendChild(script)
    }
  } catch (error) {
    console.error('Failed to initialize image optimizer:', error)
  }

  // Initialize statistics engine
  let statisticsEngine = null
  try {
    // Load statistics engine if available
    if (typeof StatisticsEngine !== 'undefined') {
      statisticsEngine = new StatisticsEngine({
        apiEndpoint: '/api/statistics',
        pollInterval: 30000, // 30 seconds
        retryAttempts: 3
      })
      await statisticsEngine.initialize()
    } else {
      console.warn('StatisticsEngine not available, loading dynamically...')
      // Dynamically load statistics engine
      const script = document.createElement('script')
      script.src = '/js/statisticsEngine.js'
      script.onload = async () => {
        statisticsEngine = new StatisticsEngine({
          apiEndpoint: '/api/statistics',
          pollInterval: 30000,
          retryAttempts: 3
        })
        await statisticsEngine.initialize()
      }
      document.head.appendChild(script)
    }
  } catch (error) {
    console.error('Failed to initialize statistics engine:', error)
  }

  // Handle browser navigation
  window.addEventListener('popstate', (event) => {
    tabNav.handlePopState(event)
  })

  // Handle initial URL hash
  const initialTab = tabNav.getTabFromUrl()
  if (initialTab !== 'home') {
    tabNav.showTab(initialTab)
  }

  // Handle PayPal return parameters
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('success') === '1') {
    // Handle successful donation
    const pendingDonation = localStorage.getItem('pendingDonation')
    if (pendingDonation) {
      try {
        const donationData = JSON.parse(pendingDonation)
        await tabNav.handleDonationSuccess(donationData)
      } catch (error) {

      }
    }
  } else if (urlParams.get('cancelled') === '1') {
    // Handle cancelled donation
    if (window.donationHandler) {
      window.donationHandler.handleDonationCancellation()
    } else {
      localStorage.removeItem('pendingDonation')
      tabNav.showDonationCancelledMessage()
    }
  }

  // Add manual refresh button for statistics
  const refreshButton = document.createElement('button')
  refreshButton.textContent = '↻ Refresh Stats'
  refreshButton.className = 'text-xs text-primary hover:underline ml-2'
  refreshButton.onclick = () => {
    if (statisticsEngine) {
      statisticsEngine.refresh()
    }
  }

  const statusElement = document.querySelector('[data-connection-status]')
  if (statusElement && statusElement.parentNode) {
    statusElement.parentNode.appendChild(refreshButton)
  }

  // Handle window resize for responsive images
  window.addEventListener('resize', () => {
    if (imageOptimizer) {
      imageOptimizer.refreshDeviceCapabilities()
    }
  })

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (statisticsEngine) {
      statisticsEngine.destroy()
    }
    if (imageOptimizer) {
      imageOptimizer.destroy()
    }
  })
})
