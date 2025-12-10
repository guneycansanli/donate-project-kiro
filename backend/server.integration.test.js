const request = require('supertest')
const express = require('express')
const path = require('path')
const fs = require('fs')
const ConfigManager = require('./config/configManager')

// Create a test server instance
function createTestServer() {
  const app = express()
  const configManager = new ConfigManager(path.join(__dirname, '../config'))
  
  app.use(express.json())
  
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
      res.status(500).json({
        success: false,
        error: 'Failed to fetch configuration',
        timestamp: new Date().toISOString()
      })
    }
  })

  app.get('/api/statistics', (req, res) => {
    try {
      const statisticsConfig = configManager.getConfig('statistics')
      res.json({
        success: true,
        data: statisticsConfig,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
        timestamp: new Date().toISOString()
      })
    }
  })

  return { app, configManager }
}

describe('Configuration API Integration Tests', () => {
  let app
  let configManager

  beforeAll(async () => {
    const testServer = createTestServer()
    app = testServer.app
    configManager = testServer.configManager
    await configManager.initialize()
  })

  afterAll(async () => {
    if (configManager) {
      await configManager.cleanup()
    }
  })

  describe('GET /api/config', () => {
    test('should return all configurations', async () => {
      const response = await request(app)
        .get('/api/config')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.statistics).toBeDefined()
      expect(response.body.data.content).toBeDefined()
      expect(response.body.data.settings).toBeDefined()
      expect(response.body.timestamp).toBeDefined()
    })
  })

  describe('GET /api/config/:name', () => {
    test('should return specific configuration', async () => {
      const response = await request(app)
        .get('/api/config/statistics')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.statistics).toBeDefined()
      expect(response.body.data.update_frequency).toBeDefined()
      expect(response.body.timestamp).toBeDefined()
    })

    test('should return 404 for non-existent configuration', async () => {
      const response = await request(app)
        .get('/api/config/nonexistent')
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('not found')
    })
  })

  describe('GET /api/statistics', () => {
    test('should return statistics configuration', async () => {
      const response = await request(app)
        .get('/api/statistics')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.statistics).toBeDefined()
      expect(response.body.data.statistics.trees_planted).toBeDefined()
      expect(response.body.data.statistics.hectares_restored).toBeDefined()
      expect(response.body.data.statistics.global_impact).toBeDefined()
    })
  })

  describe('Configuration Structure Validation', () => {
    test('statistics should have required structure', async () => {
      const response = await request(app)
        .get('/api/statistics')
        .expect(200)

      const data = response.body.data
      const stats = data.statistics
      
      expect(stats.trees_planted.value).toBeDefined()
      expect(stats.trees_planted.label).toBeDefined()
      expect(stats.trees_planted.icon).toBeDefined()
      expect(stats.trees_planted.format).toBeDefined()
      
      expect(typeof stats.trees_planted.value).toBe('number')
      expect(typeof stats.trees_planted.label).toBe('string')
      expect(typeof data.update_frequency).toBe('number')
    })

    test('content should have required structure', async () => {
      const response = await request(app)
        .get('/api/config/content')
        .expect(200)

      const content = response.body.data
      expect(content.site).toBeDefined()
      expect(content.tabs).toBeDefined()
      expect(content.paypal).toBeDefined()
      
      expect(content.paypal.business_id).toBe('73PLJSAMMTSCW')
      expect(Array.isArray(content.paypal.amounts)).toBe(true)
    })
  })
})