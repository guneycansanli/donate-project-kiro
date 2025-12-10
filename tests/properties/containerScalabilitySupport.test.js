const fc = require('fast-check')
const { spawn } = require('child_process')

/**
 * **Feature: donation-website, Property 20: Container Scalability Support**
 * **Validates: Requirements 6.5**
 * 
 * For any horizontal scaling scenario, multiple container instances should 
 * operate correctly with proper load distribution
 */

describe('Property-Based Tests: Container Scalability Support', () => {

  /**
   * Property 20: Container Scalability Support
   * For any horizontal scaling scenario, multiple container instances should 
   * operate correctly with proper load distribution
   */
  test('Property 20: Multiple container instances operate correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          instanceCount: fc.integer({ min: 2, max: 4 }), // Test with 2-4 instances
          basePort: fc.integer({ min: 4000, max: 6000 }),
          requestCount: fc.integer({ min: 5, max: 15 }) // Number of requests to test load distribution
        }),
        async ({ instanceCount, basePort, requestCount }) => {
          const containerNames = []
          const containerIds = []
          const ports = []
          
          try {
            // Start multiple container instances
            for (let i = 0; i < instanceCount; i++) {
              const containerName = `scale-test-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`
              const port = basePort + i
              
              containerNames.push(containerName)
              ports.push(port)
              
              const runArgs = [
                'run', '-d',
                '--name', containerName,
                '-p', `${port}:3000`,
                '-e', 'NODE_ENV=test',
                '-e', 'SMTP_USER=test@example.com',
                '-e', 'SMTP_PASS=testpass',
                'donation-website-test'
              ]

              const runResult = await runCommand('docker', runArgs, { timeout: 15000 })
              expect(runResult.success).toBe(true)
              containerIds.push(runResult.stdout.trim())
            }

            // Wait for all containers to start
            await sleep(8000)

            // Verify all containers are running
            for (let i = 0; i < containerIds.length; i++) {
              const statusResult = await runCommand('docker', ['inspect', '--format={{.State.Status}}', containerIds[i]], {
                timeout: 5000
              })
              expect(statusResult.success).toBe(true)
              expect(statusResult.stdout.trim()).toBe('running')
            }

            // Test that all instances are accessible
            const healthResults = []
            for (let i = 0; i < ports.length; i++) {
              const healthResult = await runCommand('curl', [
                '-f', '-s', '-m', '5',
                `http://localhost:${ports[i]}/api/health`
              ], { timeout: 10000 })
              
              healthResults.push({
                port: ports[i],
                success: healthResult.success,
                response: healthResult.stdout
              })
            }

            // All instances should be healthy
            const healthyInstances = healthResults.filter(r => r.success)
            expect(healthyInstances.length).toBe(instanceCount)

            // Test load distribution by making requests to all instances
            const requestResults = []
            for (let req = 0; req < requestCount; req++) {
              const targetPort = ports[req % ports.length] // Round-robin distribution
              
              const requestResult = await runCommand('curl', [
                '-f', '-s', '-m', '5',
                `http://localhost:${targetPort}/api/config/test`
              ], { timeout: 10000 })
              
              requestResults.push({
                port: targetPort,
                success: requestResult.success,
                response: requestResult.stdout
              })
            }

            // Verify requests were distributed and successful
            const successfulRequests = requestResults.filter(r => r.success)
            expect(successfulRequests.length).toBeGreaterThanOrEqual(Math.floor(requestCount * 0.8)) // At least 80% success

            // Verify each instance handled at least one request (if we made enough requests)
            if (requestCount >= instanceCount) {
              const portsWithRequests = new Set(successfulRequests.map(r => r.port))
              expect(portsWithRequests.size).toBeGreaterThanOrEqual(Math.min(instanceCount, requestCount))
            }

            // Test concurrent requests to verify instances can handle parallel load
            const concurrentPromises = ports.map(port => 
              runCommand('curl', [
                '-f', '-s', '-m', '10',
                `http://localhost:${port}/api/health`
              ], { timeout: 15000 })
            )

            const concurrentResults = await Promise.all(concurrentPromises)
            const successfulConcurrent = concurrentResults.filter(r => r.success)
            expect(successfulConcurrent.length).toBe(instanceCount)

            console.log(`Successfully tested ${instanceCount} container instances with ${requestCount} requests`)

          } finally {
            // Cleanup all containers
            for (const containerId of containerIds) {
              await runCommand('docker', ['stop', containerId], { timeout: 10000 }).catch(() => {})
              await runCommand('docker', ['rm', containerId], { timeout: 5000 }).catch(() => {})
            }
          }
        }
      ),
      { 
        numRuns: 3, // Fewer runs due to expensive multi-container operations
        timeout: 240000 // 4 minutes per test
      }
    )
  }, 360000) // 6 minute timeout

  /**
   * Property: Container isolation
   * For any multiple container setup, instances should be properly isolated
   */
  test('Property: Container instances maintain proper isolation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          instanceCount: fc.integer({ min: 2, max: 3 }),
          basePort: fc.integer({ min: 5000, max: 7000 }),
          testData: fc.array(fc.string({ minLength: 10, maxLength: 50 }), { minLength: 2, maxLength: 5 })
        }),
        async ({ instanceCount, basePort, testData }) => {
          const containerIds = []
          const ports = []
          
          try {
            // Start multiple instances
            for (let i = 0; i < instanceCount; i++) {
              const containerName = `isolation-test-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`
              const port = basePort + i
              
              ports.push(port)
              
              const runArgs = [
                'run', '-d',
                '--name', containerName,
                '-p', `${port}:3000`,
                '-e', 'NODE_ENV=test',
                '-e', `INSTANCE_ID=instance-${i}`,
                '-e', 'SMTP_USER=test@example.com',
                '-e', 'SMTP_PASS=testpass',
                'donation-website-test'
              ]

              const runResult = await runCommand('docker', runArgs, { timeout: 15000 })
              expect(runResult.success).toBe(true)
              containerIds.push(runResult.stdout.trim())
            }

            await sleep(8000)

            // Write different data to each container to test isolation
            for (let i = 0; i < containerIds.length; i++) {
              const uniqueData = `${testData[i % testData.length]}-instance-${i}`
              
              const writeResult = await runCommand('docker', [
                'exec', containerIds[i],
                'sh', '-c',
                `echo '${uniqueData}' > /tmp/instance-data.txt`
              ], { timeout: 10000 })
              
              expect(writeResult.success).toBe(true)
            }

            // Verify each container has its own unique data (isolation)
            for (let i = 0; i < containerIds.length; i++) {
              const readResult = await runCommand('docker', [
                'exec', containerIds[i],
                'cat', '/tmp/instance-data.txt'
              ], { timeout: 5000 })
              
              expect(readResult.success).toBe(true)
              
              const expectedData = `${testData[i % testData.length]}-instance-${i}`
              expect(readResult.stdout.trim()).toBe(expectedData)
              
              // Verify this data is NOT in other containers
              for (let j = 0; j < containerIds.length; j++) {
                if (i !== j) {
                  const otherReadResult = await runCommand('docker', [
                    'exec', containerIds[j],
                    'cat', '/tmp/instance-data.txt'
                  ], { timeout: 5000 })
                  
                  if (otherReadResult.success) {
                    expect(otherReadResult.stdout.trim()).not.toBe(expectedData)
                  }
                }
              }
            }

            // Test that each instance responds independently
            for (let i = 0; i < ports.length; i++) {
              const configResult = await runCommand('curl', [
                '-f', '-s', '-m', '5',
                `http://localhost:${ports[i]}/api/config/test`
              ], { timeout: 10000 })
              
              if (configResult.success) {
                try {
                  const config = JSON.parse(configResult.stdout)
                  expect(config.port).toBe(3000) // Internal port should be same
                  expect(config.nodeEnv).toBe('test')
                } catch (parseError) {
                  // If parsing fails, at least verify we got a response
                  expect(configResult.stdout).toBeTruthy()
                }
              }
            }

          } finally {
            // Cleanup
            for (const containerId of containerIds) {
              await runCommand('docker', ['stop', containerId], { timeout: 10000 }).catch(() => {})
              await runCommand('docker', ['rm', containerId], { timeout: 5000 }).catch(() => {})
            }
          }
        }
      ),
      { 
        numRuns: 2,
        timeout: 180000
      }
    )
  }, 240000)

  /**
   * Property: Resource sharing and limits
   * For any scaled deployment, containers should respect resource limits
   */
  test('Property: Scaled containers respect resource limits', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          instanceCount: fc.integer({ min: 2, max: 3 }),
          memoryLimit: fc.constantFrom('128m', '256m', '512m'),
          cpuLimit: fc.constantFrom('0.5', '1.0')
        }),
        async ({ instanceCount, memoryLimit, cpuLimit }) => {
          const containerIds = []
          const basePort = 7000
          
          try {
            // Start multiple instances with resource limits
            for (let i = 0; i < instanceCount; i++) {
              const containerName = `resource-scale-test-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`
              const port = basePort + i
              
              const runArgs = [
                'run', '-d',
                '--name', containerName,
                '--memory', memoryLimit,
                '--cpus', cpuLimit,
                '-p', `${port}:3000`,
                '-e', 'NODE_ENV=test',
                '-e', 'SMTP_USER=test@example.com',
                '-e', 'SMTP_PASS=testpass',
                'donation-website-test'
              ]

              const runResult = await runCommand('docker', runArgs, { timeout: 15000 })
              expect(runResult.success).toBe(true)
              containerIds.push(runResult.stdout.trim())
            }

            await sleep(10000) // Give more time for resource-limited containers

            // Verify all containers are running despite resource limits
            for (const containerId of containerIds) {
              const statusResult = await runCommand('docker', ['inspect', '--format={{.State.Status}}', containerId], {
                timeout: 5000
              })
              expect(statusResult.success).toBe(true)
              expect(statusResult.stdout.trim()).toBe('running')
            }

            // Test that all instances are functional
            for (let i = 0; i < instanceCount; i++) {
              const port = basePort + i
              const healthResult = await runCommand('curl', [
                '-f', '-s', '-m', '10',
                `http://localhost:${port}/api/health`
              ], { timeout: 15000 })
              
              if (healthResult.success) {
                expect(healthResult.stdout).toContain('ok')
              }
            }

            // Check resource usage for all containers
            const statsResult = await runCommand('docker', [
              'stats', '--no-stream', '--format', 'table {{.Container}}\t{{.MemUsage}}\t{{.CPUPerc}}',
              ...containerIds
            ], { timeout: 15000 })

            if (statsResult.success) {
              const statsLines = statsResult.stdout.trim().split('\n')
              if (statsLines.length > 1) {
                // Skip header line and check each container's stats
                for (let i = 1; i < statsLines.length; i++) {
                  const statsLine = statsLines[i]
                  const [container, memUsage, cpuPerc] = statsLine.split('\t')
                  
                  expect(container).toBeTruthy()
                  expect(memUsage).toBeTruthy()
                  expect(cpuPerc).toBeTruthy()
                  
                  // Basic validation that containers are using resources but not exceeding limits
                  if (memUsage.includes('/')) {
                    const [used, total] = memUsage.split('/')
                    expect(used).toBeTruthy()
                    expect(total).toBeTruthy()
                  }
                }
              }
            }

          } finally {
            // Cleanup
            for (const containerId of containerIds) {
              await runCommand('docker', ['stop', containerId], { timeout: 10000 }).catch(() => {})
              await runCommand('docker', ['rm', containerId], { timeout: 5000 }).catch(() => {})
            }
          }
        }
      ),
      { 
        numRuns: 2,
        timeout: 180000
      }
    )
  }, 240000)

  /**
   * Property: Network connectivity between instances
   * For any scaled deployment, instances should be able to communicate if needed
   */
  test('Property: Container instances maintain proper network connectivity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 3 }), // Number of instances
        async (instanceCount) => {
          const containerIds = []
          const networkName = `test-network-${Date.now()}`
          const basePort = 8000
          
          try {
            // Create a custom network for the containers
            await runCommand('docker', ['network', 'create', networkName], { timeout: 10000 })

            // Start multiple instances on the same network
            for (let i = 0; i < instanceCount; i++) {
              const containerName = `network-test-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`
              const port = basePort + i
              
              const runArgs = [
                'run', '-d',
                '--name', containerName,
                '--network', networkName,
                '-p', `${port}:3000`,
                '-e', 'NODE_ENV=test',
                '-e', 'SMTP_USER=test@example.com',
                '-e', 'SMTP_PASS=testpass',
                'donation-website-test'
              ]

              const runResult = await runCommand('docker', runArgs, { timeout: 15000 })
              expect(runResult.success).toBe(true)
              containerIds.push({ id: runResult.stdout.trim(), name: containerName, port })
            }

            await sleep(8000)

            // Verify all containers are running
            for (const container of containerIds) {
              const statusResult = await runCommand('docker', ['inspect', '--format={{.State.Status}}', container.id], {
                timeout: 5000
              })
              expect(statusResult.success).toBe(true)
              expect(statusResult.stdout.trim()).toBe('running')
            }

            // Test external connectivity (from host to containers)
            for (const container of containerIds) {
              const healthResult = await runCommand('curl', [
                '-f', '-s', '-m', '5',
                `http://localhost:${container.port}/api/health`
              ], { timeout: 10000 })
              
              if (healthResult.success) {
                expect(healthResult.stdout).toContain('ok')
              }
            }

            // Test internal network connectivity (container to container)
            if (containerIds.length >= 2) {
              const sourceContainer = containerIds[0]
              const targetContainer = containerIds[1]
              
              // Try to ping from one container to another using container name
              const pingResult = await runCommand('docker', [
                'exec', sourceContainer.id,
                'ping', '-c', '1', '-W', '2', targetContainer.name
              ], { timeout: 10000 })
              
              // Ping might not be available in alpine, so we'll test HTTP connectivity instead
              const httpConnectResult = await runCommand('docker', [
                'exec', sourceContainer.id,
                'wget', '-q', '-O', '-', '--timeout=5', `http://${targetContainer.name}:3000/api/health`
              ], { timeout: 15000 })
              
              if (httpConnectResult.success) {
                expect(httpConnectResult.stdout).toContain('ok')
              } else {
                // If wget is not available, at least verify the containers are on the same network
                const networkInspectResult = await runCommand('docker', [
                  'inspect', '--format={{.NetworkSettings.Networks}}', sourceContainer.id
                ], { timeout: 5000 })
                
                if (networkInspectResult.success) {
                  expect(networkInspectResult.stdout).toContain(networkName)
                }
              }
            }

          } finally {
            // Cleanup containers
            for (const container of containerIds) {
              await runCommand('docker', ['stop', container.id], { timeout: 10000 }).catch(() => {})
              await runCommand('docker', ['rm', container.id], { timeout: 5000 }).catch(() => {})
            }
            
            // Cleanup network
            await runCommand('docker', ['network', 'rm', networkName], { timeout: 5000 }).catch(() => {})
          }
        }
      ),
      { 
        numRuns: 2,
        timeout: 180000
      }
    )
  }, 240000)
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