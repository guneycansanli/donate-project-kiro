const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const compression = require('compression')
const morgan = require('morgan')
const path = require('path')
const ConfigManager = require('./config/configManager')
const EmailService = require('./services/emailService')
const ContentManager = require('./services/contentManager')

const app = express()
const PORT = process.env.PORT || 3000

// Initialize configuration manager, email service, and content manager
const configManager = new ConfigManager()
const emailService = new EmailService()
const contentManager = new ContentManager(configManager)

// Middleware
app.use(helmet())
app.use(cors())
app.use(compression())
app.use(morgan('combined'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend')))

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() })
})

// API health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Test configuration endpoint for property-based tests
app.get('/api/config/test', (req, res) => {
  try {
    const testConfig = {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT) || 3000,
      logLevel: process.env.LOG_LEVEL || 'info',
      corsOrigin: process.env.CORS_ORIGIN || '*',
      smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true'
      },
      paypal: {
        businessId: process.env.PAYPAL_BUSINESS_ID || '73PLJSAMMTSCW',
        environment: process.env.PAYPAL_ENVIRONMENT || 'sandbox'
      },
      rateLimit: {
        max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000
      }
    }
    
    res.json(testConfig)
  } catch (error) {
    console.error('Error in test config endpoint:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Configuration API endpoints
app.get('/api/config', (req, res) => {
  try {
    const allConfigs = configManager.getAllConfigs()
    res.json({
      success: true,
      data: allConfigs,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching configurations:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch configurations',
      timestamp: new Date().toISOString()
    })
  }
})

app.get('/api/config/:name', (req, res) => {
  try {
    const { name } = req.params
    const config = configManager.getConfig(name)
    
    if (!config || Object.keys(config).length === 0) {
      return res.status(404).json({
        success: false,
        error: `Configuration '${name}' not found`,
        timestamp: new Date().toISOString()
      })
    }
    
    res.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error(`Error fetching configuration ${req.params.name}:`, error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch configuration',
      timestamp: new Date().toISOString()
    })
  }
})

// Statistics endpoint for frontend polling
app.get('/api/statistics', (req, res) => {
  try {
    const statisticsConfig = configManager.getConfig('statistics')
    res.json({
      success: true,
      data: statisticsConfig,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching statistics:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      timestamp: new Date().toISOString()
    })
  }
})

// Content endpoint for frontend
app.get('/api/content', (req, res) => {
  try {
    const contentConfig = configManager.getConfig('content')
    res.json({
      success: true,
      data: contentConfig,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching content:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch content',
      timestamp: new Date().toISOString()
    })
  }
})

// Settings endpoint for frontend
app.get('/api/settings', (req, res) => {
  try {
    const settingsConfig = configManager.getConfig('settings')
    res.json({
      success: true,
      data: settingsConfig,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching settings:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch settings',
      timestamp: new Date().toISOString()
    })
  }
})

// Statistics increment endpoint for donation tracking
app.post('/api/statistics/increment', (req, res) => {
  try {
    const { donation_amount, increments } = req.body
    
    if (!donation_amount || donation_amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid donation amount',
        timestamp: new Date().toISOString()
      })
    }

    if (!increments || typeof increments !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid increments data',
        timestamp: new Date().toISOString()
      })
    }

    // Get current statistics
    const currentStats = configManager.getConfig('statistics')
    
    if (!currentStats || !currentStats.statistics) {
      return res.status(500).json({
        success: false,
        error: 'Statistics configuration not found',
        timestamp: new Date().toISOString()
      })
    }

    // Create updated statistics
    const updatedStats = JSON.parse(JSON.stringify(currentStats)) // Deep clone
    
    // Apply increments
    if (increments.trees_planted && typeof increments.trees_planted === 'number') {
      updatedStats.statistics.trees_planted.value += increments.trees_planted
    }
    
    if (increments.hectares_restored && typeof increments.hectares_restored === 'number') {
      updatedStats.statistics.hectares_restored.value += increments.hectares_restored
    }
    
    // Update last_updated timestamp
    updatedStats.last_updated = new Date().toISOString()
    
    // Update the configuration (this would typically write to file in a real implementation)
    // For now, we'll just update the in-memory configuration
    configManager.configs.set('statistics', updatedStats)
    
    console.log(`Statistics incremented: +${increments.trees_planted} trees, +${increments.hectares_restored} hectares for $${donation_amount} donation`)
    
    res.json({
      success: true,
      data: updatedStats,
      donation_amount: donation_amount,
      increments_applied: increments,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error incrementing statistics:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to increment statistics',
      timestamp: new Date().toISOString()
    })
  }
})

// Donation email receipt endpoint
app.post('/api/donations/email-receipt', async (req, res) => {
  try {
    const {
      amount,
      currency = 'USD',
      trees,
      timestamp,
      transactionId,
      payerId,
      recipientEmail
    } = req.body

    // Validate required fields
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid donation amount',
        timestamp: new Date().toISOString()
      })
    }

    if (!trees || trees <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid trees count',
        timestamp: new Date().toISOString()
      })
    }

    // For now, we'll use a default email since PayPal doesn't always provide it
    // In a real implementation, this would come from PayPal IPN or user input
    const emailAddress = recipientEmail || process.env.DEFAULT_RECEIPT_EMAIL || 'donor@example.com'

    if (!emailService.validateEmail(emailAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address',
        timestamp: new Date().toISOString()
      })
    }

    const donationData = {
      amount: parseFloat(amount),
      currency,
      trees: parseInt(trees),
      timestamp: timestamp || new Date().toISOString(),
      transaction_id: transactionId,
      payer_id: payerId
    }

    // Send receipt email
    const emailResult = await emailService.sendDonationReceipt(donationData, emailAddress)

    // Send admin notification (optional)
    try {
      await emailService.sendAdminNotification(donationData)
    } catch (adminError) {
      console.warn('Failed to send admin notification:', adminError)
      // Don't fail the request if admin notification fails
    }

    res.json({
      success: true,
      message: 'Receipt email sent successfully',
      emailResult,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error sending donation receipt:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to send receipt email',
      details: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// PayPal IPN (Instant Payment Notification) endpoint
app.post('/api/paypal/ipn', express.raw({ type: 'application/x-www-form-urlencoded' }), async (req, res) => {
  try {
    // In a real implementation, you would verify the IPN with PayPal
    // For now, we'll just log the notification
    console.log('PayPal IPN received:', req.body.toString())
    
    // Parse the IPN data
    const ipnData = new URLSearchParams(req.body.toString())
    const paymentStatus = ipnData.get('payment_status')
    const txnId = ipnData.get('txn_id')
    const payerEmail = ipnData.get('payer_email')
    const mcGross = parseFloat(ipnData.get('mc_gross'))
    
    if (paymentStatus === 'Completed' && mcGross > 0) {
      // Process successful payment
      const donationData = {
        amount: mcGross,
        currency: ipnData.get('mc_currency') || 'USD',
        trees: Math.floor(mcGross * 2), // $1 = 2 trees
        timestamp: new Date().toISOString(),
        transaction_id: txnId,
        payer_id: ipnData.get('payer_id')
      }

      // Send receipt email if payer email is available
      if (payerEmail && emailService.validateEmail(payerEmail)) {
        try {
          await emailService.sendDonationReceipt(donationData, payerEmail)
        } catch (emailError) {
          console.error('Failed to send IPN receipt email:', emailError)
        }
      }

      // Update statistics
      try {
        const increments = {
          trees_planted: donationData.trees,
          hectares_restored: Math.floor(donationData.trees / 100) // 100 trees = 1 hectare
        }
        
        // This would typically call the statistics increment endpoint internally
        console.log('IPN: Would increment statistics:', increments)
      } catch (statsError) {
        console.error('Failed to update statistics from IPN:', statsError)
      }
    }

    // Always respond with 200 to acknowledge receipt
    res.status(200).send('OK')
  } catch (error) {
    console.error('Error processing PayPal IPN:', error)
    res.status(200).send('OK') // Still acknowledge to prevent retries
  }
})

// Image validation endpoint
app.get('/api/images/validate', async (req, res) => {
  try {
    const { url } = req.query
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Image URL is required',
        timestamp: new Date().toISOString()
      })
    }

    // Basic URL validation
    try {
      new URL(url)
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format',
        timestamp: new Date().toISOString()
      })
    }

    // For external URLs, we can only validate the URL format
    // For local images, we could check file existence
    const isExternal = !url.startsWith('/') && !url.startsWith(req.get('host'))
    
    if (isExternal) {
      // External image - just validate URL format
      res.json({
        success: true,
        exists: true, // We assume external URLs exist
        isExternal: true,
        url: url,
        timestamp: new Date().toISOString()
      })
    } else {
      // Local image - check if file exists
      const fs = require('fs').promises
      const imagePath = path.join(__dirname, '../frontend', url.replace(/^\//, ''))
      
      try {
        await fs.access(imagePath)
        res.json({
          success: true,
          exists: true,
          isExternal: false,
          url: url,
          timestamp: new Date().toISOString()
        })
      } catch {
        res.json({
          success: true,
          exists: false,
          isExternal: false,
          url: url,
          timestamp: new Date().toISOString()
        })
      }
    }
  } catch (error) {
    console.error('Error validating image:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to validate image',
      timestamp: new Date().toISOString()
    })
  }
})

// Image optimization configuration endpoint
app.get('/api/images/config', (req, res) => {
  try {
    const settingsConfig = configManager.getConfig('settings')
    const imageConfig = settingsConfig?.images || {
      lazyLoadThreshold: 100,
      retryAttempts: 3,
      retryDelay: 1000,
      supportedFormats: ['webp', 'avif', 'jpg', 'jpeg', 'png', 'gif'],
      breakpoints: {
        mobile: 480,
        tablet: 768,
        desktop: 1024,
        large: 1440
      }
    }

    res.json({
      success: true,
      data: imageConfig,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching image configuration:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch image configuration',
      timestamp: new Date().toISOString()
    })
  }
})

// Email service health check
app.get('/api/email/health', async (req, res) => {
  try {
    const isHealthy = await emailService.testConnection()
    res.json({
      success: true,
      emailServiceHealthy: isHealthy,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      emailServiceHealthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// Content management endpoints
app.get('/api/content/validate', async (req, res) => {
  try {
    const contentConfig = configManager.getConfig('content')
    const validationResults = await contentManager.validateContent(contentConfig)
    
    res.json({
      success: true,
      data: validationResults,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error validating content:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to validate content',
      timestamp: new Date().toISOString()
    })
  }
})

app.get('/api/content/statistics', async (req, res) => {
  try {
    const contentConfig = configManager.getConfig('content')
    const statistics = contentManager.getContentStatistics(contentConfig)
    
    res.json({
      success: true,
      data: statistics,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error getting content statistics:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get content statistics',
      timestamp: new Date().toISOString()
    })
  }
})

app.post('/api/content/validate', async (req, res) => {
  try {
    const { content } = req.body
    
    if (!content || typeof content !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Content object is required',
        timestamp: new Date().toISOString()
      })
    }
    
    const validationResults = await contentManager.validateContent(content)
    
    res.json({
      success: true,
      data: validationResults,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error validating submitted content:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to validate content',
      timestamp: new Date().toISOString()
    })
  }
})

// Serve main application
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'))
})

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error(err.stack) // eslint-disable-line no-console
  res.status(500).json({ 
    success: false,
    error: 'Something went wrong!',
    timestamp: new Date().toISOString()
  })
})

// Initialize configuration manager and start server
async function startServer() {
  try {
    await configManager.initialize()
    console.log('Configuration manager initialized successfully')
    
    await emailService.initialize()
    console.log('Email service initialized successfully')
    
    // Set up configuration change listeners for real-time updates
    configManager.on('configChanged', (event) => {
      console.log(`Configuration changed: ${event.filename} at ${event.timestamp}`)
    })
    
    configManager.on('configError', (event) => {
      console.error(`Configuration error for ${event.name}:`, event.error)
    })
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`) // eslint-disable-line no-console
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`) // eslint-disable-line no-console
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully')
  await configManager.cleanup()
  process.exit(0)
})

process.on('SIGINT', async () => {
  
  await configManager.cleanup()
  process.exit(0)
})

startServer()
