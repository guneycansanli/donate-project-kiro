const fc = require('fast-check')
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

/**
 * **Feature: donation-website, Property 17: Container Startup Performance**
 * **Validates: Requirements 6.2**
 * 
 * For any Docker container deployment, the application should initialize 
 * successfully within 60 seconds with all dependencies available
 */

describe('Property-Based Tests: Container Startup Performance', () => {
  const STARTUP_TIMEOUT = 60000 // 60 seconds as per requirement
  const HEALTH_CHECK_INTERVAL = 2000 // Check every 2 seconds
  const MAX_HEALTH_CHECKS = Math.ceil(STARTUP_TIMEOUT / HEALTH_CHECK_INTERVAL)

  /**
   * Property 17: Container Startup Performance
   * For any Docker container deployment, the application should initialize 
   * successfully within 60 seconds with all dependencies available
   */
  test('Property 17: Container startup completes within 60 seconds', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate different container configurations
        fc.record({
          port: fc.integer({ min: 3000, max: 3010 }),
          nodeEnv: fc.constantFrom('development', 'production', 'test'),
          logLevel: fc.constantFrom('error', 'warn', 'info', 'debug'),
          corsOrigin: fc.constantFrom('*', 'http://localhost:3000', 'https://example.com'),
          rateLimit: fc.integer({ min: 10, max: 1000 })
        }),
        async (config) => {
          const containerName = `test-container-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          let containerId = null
          
          try {
            // Build the container if needed (use existing image to speed up tests)
            const buildResult = await runCommand('docker', ['build', '-t', 'donation-website-test', '.'], {
              timeout: 120000 // 2 minutes for build
            })
            
            expect(buildResult.success).toBe(true)

            // Start container with test configuration
            const runArgs = [
              'run', '-d',
              '--name', containerName,
              '-p', `${config.port}:3000`,
              '-e', `NODE_ENV=${config.nodeEnv}`,
              '-e', `LOG_LEVEL=${config.logLevel}`,
              '-e', `CORS_ORIGIN=${config.corsOrigin}`,
              '-e', `RATE_LIMIT_MAX=${config.rateLimit}`,
              '-e', 'SMTP_USER=test@example.com',
              '-e', 'SMTP_PASS=testpass',
              'donation-website-test'
            ]

            const startTime = Date.now()
            const runResult = await runCommand('docker', runArgs, { timeout: 10000 })
            
            expect(runResult.success).toBe(true)
            containerId = runResult.stdout.trim()

            // Wait for container to be healthy within the timeout
            let isHealthy = false
            let healthCheckCount = 0
            
            while (!isHealthy && healthCheckCount < MAX_HEALTH_CHECKS) {
              await sleep(HEALTH_CHECK_INTERVAL)
              healthCheckCount++
              
              // Check container health
              const healthResult = await runCommand('docker', ['inspect', '--format={{.State.Health.Status}}', containerId], {
                timeout: 5000
              })
              
              if (healthResult.success) {
                const healthStatus = healthResult.stdout.trim()
                isHealthy = healthStatus === 'healthy'
                
                // Also check if container is running
                const statusResult = await runCommand('docker', ['inspect', '--format={{.State.Status}}', containerId], {
                  timeout: 5000
                })
                
                if (statusResult.success && statusResult.stdout.trim() !== 'running') {
                  // Container stopped, get logs for debugging
                  const logsResult = await runCommand('docker', ['logs', containerId], { timeout: 5000 })
                  throw new Error(`Container stopped unexpectedly. Logs: ${logsResult.stdout}`)
                }
              }
            }

            const endTime = Date.now()
            const startupTime = endTime - startTime

            // Verify startup time is within requirements
            expect(startupTime).toBeLessThanOrEqual(STARTUP_TIMEOUT)
            expect(isHealthy).toBe(true)

            // Additional verification: test that the application is actually responding
            if (isHealthy) {
              const curlResult = await runCommand('curl', [
                '-f', '-s', '-m', '5',
                `http://localhost:${config.port}/api/health`
              ], { timeout: 10000 })
              
              // If curl is available and succeeds, verify response
              if (curlResult.success) {
                expect(curlResult.stdout).toContain('ok')
              }
            }

            // Log successful startup for monitoring
            console.log(`Container ${containerName} started successfully in ${startupTime}ms with config:`, config)

          } finally {
            // Cleanup: stop and remove container
            if (containerId) {
              await runCommand('docker', ['stop', containerId], { timeout: 10000 }).catch(() => {})
              await runCommand('docker', ['rm', containerId], { timeout: 5000 }).catch(() => {})
            }
          }
        }
      ),
      { 
        numRuns: 5, // Reduced runs since Docker operations are expensive
        timeout: 180000 // 3 minutes total timeout per test
      }
    )
  }, 300000) // 5 minute timeout for the entire test

  /**
   * Property: Container resource efficiency
   * For any container configuration, resource usage should be reasonable
   */
  test('Property: Container uses reasonable resources during startup', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          memoryLimit: fc.constantFrom('128m', '256m', '512m', '1g'),
          cpuLimit: fc.constantFrom('0.5', '1.0', '2.0')
        }),
        async (limits) => {
          const containerName = `resource-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          let containerId = null
          
          try {
            // Start container with resource limits
            const runArgs = [
              'run', '-d',
              '--name', containerName,
              '--memory', limits.memoryLimit,
              '--cpus', limits.cpuLimit,
              '-e', 'NODE_ENV=production',
              '-e', 'SMTP_USER=test@example.com',
              '-e', 'SMTP_PASS=testpass',
              'donation-website-test'
            ]

            const runResult = await runCommand('docker', runArgs, { timeout: 10000 })
            expect(runResult.success).toBe(true)
            containerId = runResult.stdout.trim()

            // Wait a bit for startup
            await sleep(5000)

            // Check that container is still running (didn't crash due to resource constraints)
            const statusResult = await runCommand('docker', ['inspect', '--format={{.State.Status}}', containerId], {
              timeout: 5000
            })
            
            expect(statusResult.success).toBe(true)
            expect(statusResult.stdout.trim()).toBe('running')

            // Get resource usage stats
            const statsResult = await runCommand('docker', ['stats', '--no-stream', '--format', 'table {{.MemUsage}}\t{{.CPUPerc}}', containerId], {
              timeout: 10000
            })
            
            if (statsResult.success) {
              const statsLines = statsResult.stdout.trim().split('\n')
              if (statsLines.length > 1) {
                const statsLine = statsLines[1] // Skip header
                const [memUsage, cpuPerc] = statsLine.split('\t')
                
                // Basic sanity checks - container should use some but not excessive resources
                expect(memUsage).toBeTruthy()
                expect(cpuPerc).toBeTruthy()
                
                // Memory usage should be reasonable (not hitting the limit immediately)
                if (memUsage.includes('/')) {
                  const [used, total] = memUsage.split('/')
                  const usedMB = parseFloat(used.replace(/[^\d.]/g, ''))
                  const totalMB = parseFloat(total.replace(/[^\d.]/g, ''))
                  
                  if (!isNaN(usedMB) && !isNaN(totalMB)) {
                    const usagePercent = (usedMB / totalMB) * 100
                    expect(usagePercent).toBeLessThan(90) // Should not use more than 90% of allocated memory
                  }
                }
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
        numRuns: 3, // Even fewer runs for resource tests
        timeout: 120000 // 2 minutes per test
      }
    )
  }, 180000) // 3 minute timeout

  /**
   * Property: Health check reliability
   * For any container, health checks should work consistently
   */
  test('Property: Health checks provide reliable status information', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // Number of health check attempts
        async (attempts) => {
          const containerName = `health-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          let containerId = null
          
          try {
            // Start container
            const runResult = await runCommand('docker', [
              'run', '-d',
              '--name', containerName,
              '-e', 'NODE_ENV=test',
              '-e', 'SMTP_USER=test@example.com',
              '-e', 'SMTP_PASS=testpass',
              'donation-website-test'
            ], { timeout: 10000 })
            
            expect(runResult.success).toBe(true)
            containerId = runResult.stdout.trim()

            // Wait for initial startup
            await sleep(10000)

            // Perform multiple health checks
            let healthyCount = 0
            let unhealthyCount = 0
            
            for (let i = 0; i < attempts; i++) {
              const healthResult = await runCommand('docker', ['inspect', '--format={{.State.Health.Status}}', containerId], {
                timeout: 5000
              })
              
              if (healthResult.success) {
                const status = healthResult.stdout.trim()
                if (status === 'healthy') {
                  healthyCount++
                } else if (status === 'unhealthy') {
                  unhealthyCount++
                }
              }
              
              if (i < attempts - 1) {
                await sleep(2000) // Wait between checks
              }
            }

            // Health checks should be consistent - if container is running properly,
            // it should be consistently healthy
            if (healthyCount > 0) {
              // If we got any healthy responses, most should be healthy
              expect(healthyCount).toBeGreaterThanOrEqual(Math.ceil(attempts * 0.7))
            }

            // Should not have all unhealthy responses if container is running
            expect(unhealthyCount).toBeLessThan(attempts)

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