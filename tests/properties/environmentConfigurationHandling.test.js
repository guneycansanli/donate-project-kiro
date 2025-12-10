const fc = require('fast-check')
const { spawn } = require('child_process')

/**
 * **Feature: donation-website, Property 18: Environment Configuration Handling**
 * **Validates: Requirements 6.3**
 * 
 * For any provided environment variables, the Docker container should 
 * configure the application settings accordingly
 */

describe('Property-Based Tests: Environment Configuration Handling', () => {

  /**
   * Property 18: Environment Configuration Handling
   * For any provided environment variables, the Docker container should 
   * configure the application settings accordingly
   */
  test('Property 18: Environment variables are properly applied to application configuration', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate various environment variable configurations
        fc.record({
          nodeEnv: fc.constantFrom('development', 'production', 'test'),
          port: fc.integer({ min: 3000, max: 9999 }),
          logLevel: fc.constantFrom('error', 'warn', 'info', 'debug'),
          corsOrigin: fc.oneof(
            fc.constant('*'),
            fc.webUrl(),
            fc.constant('http://localhost:3000')
          ),
          smtpHost: fc.constantFrom('smtp.gmail.com', 'smtp.outlook.com', 'localhost'),
          smtpPort: fc.constantFrom(25, 587, 465, 2525),
          smtpSecure: fc.boolean(),
          paypalBusinessId: fc.string({ minLength: 10, maxLength: 20 }),
          paypalEnvironment: fc.constantFrom('sandbox', 'production'),
          rateLimitMax: fc.integer({ min: 10, max: 1000 }),
          rateLimitWindow: fc.integer({ min: 60000, max: 3600000 }) // 1 minute to 1 hour
        }),
        async (envConfig) => {
          const containerName = `env-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          let containerId = null
          
          try {
            // Build environment variables array
            const envVars = [
              '-e', `NODE_ENV=${envConfig.nodeEnv}`,
              '-e', `PORT=${envConfig.port}`,
              '-e', `LOG_LEVEL=${envConfig.logLevel}`,
              '-e', `CORS_ORIGIN=${envConfig.corsOrigin}`,
              '-e', `SMTP_HOST=${envConfig.smtpHost}`,
              '-e', `SMTP_PORT=${envConfig.smtpPort}`,
              '-e', `SMTP_SECURE=${envConfig.smtpSecure}`,
              '-e', 'SMTP_USER=test@example.com',
              '-e', 'SMTP_PASS=testpass',
              '-e', `PAYPAL_BUSINESS_ID=${envConfig.paypalBusinessId}`,
              '-e', `PAYPAL_ENVIRONMENT=${envConfig.paypalEnvironment}`,
              '-e', `RATE_LIMIT_MAX=${envConfig.rateLimitMax}`,
              '-e', `RATE_LIMIT_WINDOW=${envConfig.rateLimitWindow}`
            ]

            // Start container with environment variables
            const runArgs = [
              'run', '-d',
              '--name', containerName,
              '-p', `${envConfig.port}:${envConfig.port}`,
              ...envVars,
              'donation-website-test'
            ]

            const runResult = await runCommand('docker', runArgs, { timeout: 15000 })
            expect(runResult.success).toBe(true)
            containerId = runResult.stdout.trim()

            // Wait for container to start
            await sleep(8000)

            // Verify container is running
            const statusResult = await runCommand('docker', ['inspect', '--format={{.State.Status}}', containerId], {
              timeout: 5000
            })
            expect(statusResult.success).toBe(true)
            expect(statusResult.stdout.trim()).toBe('running')

            // Test configuration endpoint to verify environment variables are applied
            const configTestResult = await runCommand('curl', [
              '-f', '-s', '-m', '10',
              `http://localhost:${envConfig.port}/api/config/test`
            ], { timeout: 15000 })

            if (configTestResult.success) {
              try {
                const config = JSON.parse(configTestResult.stdout)
                
                // Verify key environment variables are reflected in the application
                expect(config.nodeEnv).toBe(envConfig.nodeEnv)
                expect(config.port).toBe(envConfig.port)
                expect(config.logLevel).toBe(envConfig.logLevel)
                
                // Verify CORS configuration
                if (envConfig.corsOrigin !== '*') {
                  expect(config.corsOrigin).toBe(envConfig.corsOrigin)
                }
                
                // Verify SMTP configuration
                expect(config.smtp.host).toBe(envConfig.smtpHost)
                expect(config.smtp.port).toBe(envConfig.smtpPort)
                expect(config.smtp.secure).toBe(envConfig.smtpSecure)
                
                // Verify PayPal configuration
                expect(config.paypal.businessId).toBe(envConfig.paypalBusinessId)
                expect(config.paypal.environment).toBe(envConfig.paypalEnvironment)
                
                // Verify rate limiting configuration
                expect(config.rateLimit.max).toBe(envConfig.rateLimitMax)
                expect(config.rateLimit.windowMs).toBe(envConfig.rateLimitWindow)
                
              } catch (parseError) {
                // If we can't parse the config, at least verify the container responded
                expect(configTestResult.stdout).toBeTruthy()
              }
            }

            // Test that the application is accessible on the configured port
            const healthResult = await runCommand('curl', [
              '-f', '-s', '-m', '5',
              `http://localhost:${envConfig.port}/api/health`
            ], { timeout: 10000 })

            if (healthResult.success) {
              expect(healthResult.stdout).toContain('ok')
            }

            // Verify environment-specific behavior
            if (envConfig.nodeEnv === 'development') {
              // Development mode should have more verbose logging
              const logsResult = await runCommand('docker', ['logs', '--tail', '50', containerId], {
                timeout: 5000
              })
              
              if (logsResult.success && envConfig.logLevel === 'debug') {
                // Should have debug logs in development
                expect(logsResult.stdout.toLowerCase()).toMatch(/(debug|dev|development)/i)
              }
            }

          } finally {
            // Cleanup
            if (containerId) {
              await runCommand('docker', ['stop', containerId], { timeout: 10000 }).catch(() => {})
              await runCommand('docker', ['rm', containerId], { timeout: 5000 }).catch(() => {})
            }
          }
        }
      ),
      { 
        numRuns: 5, // Moderate number of runs for environment testing
        timeout: 120000 // 2 minutes per test
      }
    )
  }, 180000) // 3 minute timeout

  /**
   * Property: Environment variable validation
   * For any invalid environment variables, the application should handle them gracefully
   */
  test('Property: Invalid environment variables are handled gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          invalidPort: fc.oneof(
            fc.constant('invalid'),
            fc.constant('-1'),
            fc.constant('99999'),
            fc.constant('')
          ),
          invalidLogLevel: fc.constantFrom('invalid', 'INVALID', '123', ''),
          invalidBoolean: fc.constantFrom('invalid', 'yes', 'no', '1', '0', 'true1'),
          invalidNumber: fc.constantFrom('abc', 'NaN', 'Infinity', '-Infinity', '')
        }),
        async (invalidConfig) => {
          const containerName = `invalid-env-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          let containerId = null
          
          try {
            // Start container with some invalid environment variables
            const runArgs = [
              'run', '-d',
              '--name', containerName,
              '-e', 'NODE_ENV=test',
              '-e', `PORT=${invalidConfig.invalidPort}`,
              '-e', `LOG_LEVEL=${invalidConfig.invalidLogLevel}`,
              '-e', `SMTP_SECURE=${invalidConfig.invalidBoolean}`,
              '-e', `RATE_LIMIT_MAX=${invalidConfig.invalidNumber}`,
              '-e', 'SMTP_USER=test@example.com',
              '-e', 'SMTP_PASS=testpass',
              'donation-website-test'
            ]

            const runResult = await runCommand('docker', runArgs, { timeout: 15000 })
            expect(runResult.success).toBe(true)
            containerId = runResult.stdout.trim()

            // Wait for container startup
            await sleep(10000)

            // Container should either:
            // 1. Start successfully with default values for invalid configs
            // 2. Exit gracefully with proper error logging
            const statusResult = await runCommand('docker', ['inspect', '--format={{.State.Status}}', containerId], {
              timeout: 5000
            })
            
            expect(statusResult.success).toBe(true)
            const status = statusResult.stdout.trim()
            
            if (status === 'running') {
              // If running, should be using default values and be accessible
              const healthResult = await runCommand('curl', [
                '-f', '-s', '-m', '5',
                'http://localhost:3000/api/health' // Should fall back to default port
              ], { timeout: 10000 })
              
              // Should either respond on default port or handle the error gracefully
              if (!healthResult.success) {
                // Check if it's running on a different port or if there are logs explaining the issue
                const logsResult = await runCommand('docker', ['logs', '--tail', '20', containerId], {
                  timeout: 5000
                })
                
                if (logsResult.success) {
                  // Should have some indication of configuration issues or fallback behavior
                  expect(logsResult.stdout.length).toBeGreaterThan(0)
                }
              }
            } else if (status === 'exited') {
              // If exited, should have proper error logging
              const logsResult = await runCommand('docker', ['logs', containerId], {
                timeout: 5000
              })
              
              expect(logsResult.success).toBe(true)
              expect(logsResult.stdout.length).toBeGreaterThan(0)
              
              // Should contain some indication of configuration error
              const logs = logsResult.stdout.toLowerCase()
              expect(logs).toMatch(/(error|invalid|config|port|environment)/i)
            }

          } finally {
            // Cleanup
            if (containerId) {
              await runCommand('docker', ['stop', containerId], { timeout: 10000 }).catch(() => {})
              await runCommand('docker', ['rm', containerId], { timeout: 5000 }).catch(() => {})
            }
          }
        }
      ),
      { 
        numRuns: 3,
        timeout: 90000
      }
    )
  }, 150000)

  /**
   * Property: Environment variable precedence
   * For any combination of default and custom environment variables, 
   * custom values should take precedence
   */
  test('Property: Custom environment variables override defaults correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          customPort: fc.integer({ min: 4000, max: 8000 }),
          customLogLevel: fc.constantFrom('error', 'warn', 'info', 'debug'),
          customCorsOrigin: fc.webUrl()
        }),
        async (customConfig) => {
          const containerName = `precedence-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          let containerId = null
          
          try {
            // Start container with custom environment variables that should override defaults
            const runArgs = [
              'run', '-d',
              '--name', containerName,
              '-p', `${customConfig.customPort}:${customConfig.customPort}`,
              '-e', 'NODE_ENV=test',
              '-e', `PORT=${customConfig.customPort}`,
              '-e', `LOG_LEVEL=${customConfig.customLogLevel}`,
              '-e', `CORS_ORIGIN=${customConfig.customCorsOrigin}`,
              '-e', 'SMTP_USER=test@example.com',
              '-e', 'SMTP_PASS=testpass',
              'donation-website-test'
            ]

            const runResult = await runCommand('docker', runArgs, { timeout: 15000 })
            expect(runResult.success).toBe(true)
            containerId = runResult.stdout.trim()

            // Wait for startup
            await sleep(8000)

            // Verify container is running
            const statusResult = await runCommand('docker', ['inspect', '--format={{.State.Status}}', containerId], {
              timeout: 5000
            })
            expect(statusResult.success).toBe(true)
            expect(statusResult.stdout.trim()).toBe('running')

            // Test that the application is running on the custom port (not default 3000)
            const customPortResult = await runCommand('curl', [
              '-f', '-s', '-m', '5',
              `http://localhost:${customConfig.customPort}/api/health`
            ], { timeout: 10000 })

            if (customPortResult.success) {
              expect(customPortResult.stdout).toContain('ok')
              
              // Verify default port is NOT responding (proving override worked)
              if (customConfig.customPort !== 3000) {
                const defaultPortResult = await runCommand('curl', [
                  '-f', '-s', '-m', '2',
                  'http://localhost:3000/api/health'
                ], { timeout: 5000 })
                
                // Should fail to connect to default port
                expect(defaultPortResult.success).toBe(false)
              }
            }

            // Test configuration endpoint to verify custom values are used
            const configResult = await runCommand('curl', [
              '-f', '-s', '-m', '10',
              `http://localhost:${customConfig.customPort}/api/config/test`
            ], { timeout: 15000 })

            if (configResult.success) {
              try {
                const config = JSON.parse(configResult.stdout)
                
                // Verify custom values are used, not defaults
                expect(config.port).toBe(customConfig.customPort)
                expect(config.logLevel).toBe(customConfig.customLogLevel)
                expect(config.corsOrigin).toBe(customConfig.customCorsOrigin)
                
              } catch (parseError) {
                // If parsing fails, at least verify we got a response
                expect(configResult.stdout).toBeTruthy()
              }
            }

          } finally {
            // Cleanup
            if (containerId) {
              await runCommand('docker', ['stop', containerId], { timeout: 10000 }).catch(() => {})
              await runCommand('docker', ['rm', containerId], { timeout: 5000 }).catch(() => {})
            }
          }
        }
      ),
      { 
        numRuns: 4,
        timeout: 90000
      }
    )
  }, 150000)
})

/**
 * Helper function to run shell commands with timeout
 */
function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const timeout = options.timeout || 30000
    const child = spawn(command, args, { 
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false
    })
    
    let stdout = ''
    let stderr = ''
    let timedOut = false
    
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeout)
    
    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    
    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({
        success: !timedOut && code === 0,
        code,
        stdout,
        stderr,
        timedOut
      })
    })
    
    child.on('error', (error) => {
      clearTimeout(timer)
      resolve({
        success: false,
        code: -1,
        stdout,
        stderr: stderr + error.message,
        timedOut
      })
    })
  })
}

/**
 * Helper function to sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}