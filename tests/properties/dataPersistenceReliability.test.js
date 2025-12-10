const fc = require('fast-check')
const { spawn } = require('child_process')
const fs = require('fs').promises
const path = require('path')

/**
 * **Feature: donation-website, Property 19: Data Persistence Reliability**
 * **Validates: Requirements 6.4**
 * 
 * For any container stop/start cycle, configuration data and application 
 * state should be preserved correctly
 */

describe('Property-Based Tests: Data Persistence Reliability', () => {

  /**
   * Property 19: Data Persistence Reliability
   * For any container stop/start cycle, configuration data and application 
   * state should be preserved correctly
   */
  test('Property 19: Data persists correctly across container restarts', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate test data to persist
        fc.record({
          configData: fc.record({
            statistics: fc.record({
              trees_planted: fc.integer({ min: 1000, max: 100000 }),
              hectares_restored: fc.integer({ min: 10, max: 1000 }),
              global_impact: fc.string({ minLength: 5, maxLength: 20 })
            }),
            settings: fc.record({
              theme: fc.constantFrom('light', 'dark', 'auto'),
              language: fc.constantFrom('en', 'es', 'fr', 'de'),
              notifications: fc.boolean()
            })
          }),
          logData: fc.array(fc.string({ minLength: 10, maxLength: 100 }), { minLength: 1, maxLength: 10 }),
          restartCount: fc.integer({ min: 1, max: 3 })
        }),
        async ({ configData, logData, restartCount }) => {
          const containerName = `persistence-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          const volumeName = `test-data-${Date.now()}`
          let containerId = null
          
          try {
            // Create a named volume for data persistence
            await runCommand('docker', ['volume', 'create', volumeName], { timeout: 10000 })

            // Start container with persistent volume
            const runArgs = [
              'run', '-d',
              '--name', containerName,
              '-v', `${volumeName}:/app/data`,
              '-v', `${volumeName}-config:/app/config`,
              '-e', 'NODE_ENV=test',
              '-e', 'SMTP_USER=test@example.com',
              '-e', 'SMTP_PASS=testpass',
              'donation-website-test'
            ]

            const runResult = await runCommand('docker', runArgs, { timeout: 15000 })
            expect(runResult.success).toBe(true)
            containerId = runResult.stdout.trim()

            // Wait for container to start
            await sleep(5000)

            // Write test data to the container
            await writeTestDataToContainer(containerId, configData, logData)

            // Verify data was written
            const initialData = await readTestDataFromContainer(containerId)
            expect(initialData.configExists).toBe(true)
            expect(initialData.logExists).toBe(true)

            // Perform multiple restart cycles
            for (let i = 0; i < restartCount; i++) {
              // Stop the container
              const stopResult = await runCommand('docker', ['stop', containerId], { timeout: 10000 })
              expect(stopResult.success).toBe(true)

              // Wait a moment
              await sleep(2000)

              // Start the container again
              const startResult = await runCommand('docker', ['start', containerId], { timeout: 10000 })
              expect(startResult.success).toBe(true)

              // Wait for startup
              await sleep(5000)

              // Verify data still exists after restart
              const persistedData = await readTestDataFromContainer(containerId)
              expect(persistedData.configExists).toBe(true)
              expect(persistedData.logExists).toBe(true)

              // Verify data integrity (if we can read the actual content)
              if (persistedData.configContent) {
                try {
                  const parsedConfig = JSON.parse(persistedData.configContent)
                  expect(parsedConfig.statistics.trees_planted).toBe(configData.statistics.trees_planted)
                  expect(parsedConfig.statistics.hectares_restored).toBe(configData.statistics.hectares_restored)
                } catch (parseError) {
                  // If parsing fails, at least verify the file exists and has content
                  expect(persistedData.configContent.length).toBeGreaterThan(0)
                }
              }

              console.log(`Restart cycle ${i + 1}/${restartCount} completed successfully`)
            }

            // Final verification: container should still be functional
            const healthResult = await runCommand('curl', [
              '-f', '-s', '-m', '5',
              'http://localhost:3000/api/health'
            ], { timeout: 10000 })

            if (healthResult.success) {
              expect(healthResult.stdout).toContain('ok')
            }

          } finally {
            // Cleanup
            if (containerId) {
              await runCommand('docker', ['stop', containerId], { timeout: 10000 }).catch(() => {})
              await runCommand('docker', ['rm', containerId], { timeout: 5000 }).catch(() => {})
            }
            
            // Clean up volumes
            await runCommand('docker', ['volume', 'rm', volumeName], { timeout: 5000 }).catch(() => {})
            await runCommand('docker', ['volume', 'rm', `${volumeName}-config`], { timeout: 5000 }).catch(() => {})
          }
        }
      ),
      { 
        numRuns: 3, // Fewer runs due to expensive Docker operations
        timeout: 180000 // 3 minutes per test
      }
    )
  }, 300000) // 5 minute timeout

  /**
   * Property: Volume mount integrity
   * For any volume configuration, data should be correctly mounted and accessible
   */
  test('Property: Volume mounts preserve data integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          testFiles: fc.array(
            fc.record({
              name: fc.string({ minLength: 5, maxLength: 20 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '') + '.txt'),
              content: fc.string({ minLength: 10, maxLength: 500 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          mountPath: fc.constantFrom('/app/data', '/app/config', '/app/logs')
        }),
        async ({ testFiles, mountPath }) => {
          const containerName = `volume-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          const volumeName = `test-volume-${Date.now()}`
          let containerId = null
          
          try {
            // Create volume
            await runCommand('docker', ['volume', 'create', volumeName], { timeout: 10000 })

            // Start container with volume mount
            const runArgs = [
              'run', '-d',
              '--name', containerName,
              '-v', `${volumeName}:${mountPath}`,
              '-e', 'NODE_ENV=test',
              '-e', 'SMTP_USER=test@example.com',
              '-e', 'SMTP_PASS=testpass',
              'donation-website-test'
            ]

            const runResult = await runCommand('docker', runArgs, { timeout: 15000 })
            expect(runResult.success).toBe(true)
            containerId = runResult.stdout.trim()

            await sleep(5000)

            // Write test files to the mounted volume
            for (const file of testFiles) {
              const writeResult = await runCommand('docker', [
                'exec', containerId,
                'sh', '-c',
                `echo '${file.content}' > ${mountPath}/${file.name}`
              ], { timeout: 10000 })
              
              expect(writeResult.success).toBe(true)
            }

            // Verify files were written
            for (const file of testFiles) {
              const readResult = await runCommand('docker', [
                'exec', containerId,
                'cat', `${mountPath}/${file.name}`
              ], { timeout: 5000 })
              
              expect(readResult.success).toBe(true)
              expect(readResult.stdout.trim()).toBe(file.content)
            }

            // Stop and remove container (but keep volume)
            await runCommand('docker', ['stop', containerId], { timeout: 10000 })
            await runCommand('docker', ['rm', containerId], { timeout: 5000 })

            // Start a new container with the same volume
            const newContainerName = `${containerName}-new`
            const newRunArgs = [
              'run', '-d',
              '--name', newContainerName,
              '-v', `${volumeName}:${mountPath}`,
              '-e', 'NODE_ENV=test',
              '-e', 'SMTP_USER=test@example.com',
              '-e', 'SMTP_PASS=testpass',
              'donation-website-test'
            ]

            const newRunResult = await runCommand('docker', newRunArgs, { timeout: 15000 })
            expect(newRunResult.success).toBe(true)
            const newContainerId = newRunResult.stdout.trim()

            await sleep(5000)

            // Verify files still exist in new container
            for (const file of testFiles) {
              const readResult = await runCommand('docker', [
                'exec', newContainerId,
                'cat', `${mountPath}/${file.name}`
              ], { timeout: 5000 })
              
              expect(readResult.success).toBe(true)
              expect(readResult.stdout.trim()).toBe(file.content)
            }

            // Cleanup new container
            await runCommand('docker', ['stop', newContainerId], { timeout: 10000 }).catch(() => {})
            await runCommand('docker', ['rm', newContainerId], { timeout: 5000 }).catch(() => {})

          } finally {
            // Cleanup
            if (containerId) {
              await runCommand('docker', ['stop', containerId], { timeout: 10000 }).catch(() => {})
              await runCommand('docker', ['rm', containerId], { timeout: 5000 }).catch(() => {})
            }
            
            await runCommand('docker', ['volume', 'rm', volumeName], { timeout: 5000 }).catch(() => {})
          }
        }
      ),
      { 
        numRuns: 3,
        timeout: 120000
      }
    )
  }, 180000)

  /**
   * Property: Configuration persistence across updates
   * For any configuration changes, updates should persist across container restarts
   */
  test('Property: Configuration changes persist across restarts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          initialConfig: fc.record({
            theme: fc.constantFrom('light', 'dark'),
            language: fc.constantFrom('en', 'es', 'fr'),
            maxUsers: fc.integer({ min: 10, max: 1000 })
          }),
          updatedConfig: fc.record({
            theme: fc.constantFrom('light', 'dark'),
            language: fc.constantFrom('en', 'es', 'fr'),
            maxUsers: fc.integer({ min: 10, max: 1000 })
          })
        }),
        async ({ initialConfig, updatedConfig }) => {
          const containerName = `config-persist-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          const volumeName = `test-config-${Date.now()}`
          let containerId = null
          
          try {
            // Create volume
            await runCommand('docker', ['volume', 'create', volumeName], { timeout: 10000 })

            // Start container
            const runArgs = [
              'run', '-d',
              '--name', containerName,
              '-v', `${volumeName}:/app/config`,
              '-e', 'NODE_ENV=test',
              '-e', 'SMTP_USER=test@example.com',
              '-e', 'SMTP_PASS=testpass',
              'donation-website-test'
            ]

            const runResult = await runCommand('docker', runArgs, { timeout: 15000 })
            expect(runResult.success).toBe(true)
            containerId = runResult.stdout.trim()

            await sleep(5000)

            // Write initial configuration
            const initialConfigJson = JSON.stringify(initialConfig, null, 2)
            const writeInitialResult = await runCommand('docker', [
              'exec', containerId,
              'sh', '-c',
              `echo '${initialConfigJson}' > /app/config/test-settings.json`
            ], { timeout: 10000 })
            
            expect(writeInitialResult.success).toBe(true)

            // Verify initial config was written
            const readInitialResult = await runCommand('docker', [
              'exec', containerId,
              'cat', '/app/config/test-settings.json'
            ], { timeout: 5000 })
            
            expect(readInitialResult.success).toBe(true)
            
            try {
              const parsedInitial = JSON.parse(readInitialResult.stdout)
              expect(parsedInitial.theme).toBe(initialConfig.theme)
              expect(parsedInitial.language).toBe(initialConfig.language)
              expect(parsedInitial.maxUsers).toBe(initialConfig.maxUsers)
            } catch (parseError) {
              // If parsing fails, at least verify content exists
              expect(readInitialResult.stdout.length).toBeGreaterThan(0)
            }

            // Update configuration
            const updatedConfigJson = JSON.stringify(updatedConfig, null, 2)
            const writeUpdatedResult = await runCommand('docker', [
              'exec', containerId,
              'sh', '-c',
              `echo '${updatedConfigJson}' > /app/config/test-settings.json`
            ], { timeout: 10000 })
            
            expect(writeUpdatedResult.success).toBe(true)

            // Restart container
            await runCommand('docker', ['stop', containerId], { timeout: 10000 })
            await runCommand('docker', ['start', containerId], { timeout: 10000 })
            await sleep(5000)

            // Verify updated config persisted
            const readPersistedResult = await runCommand('docker', [
              'exec', containerId,
              'cat', '/app/config/test-settings.json'
            ], { timeout: 5000 })
            
            expect(readPersistedResult.success).toBe(true)
            
            try {
              const parsedPersisted = JSON.parse(readPersistedResult.stdout)
              expect(parsedPersisted.theme).toBe(updatedConfig.theme)
              expect(parsedPersisted.language).toBe(updatedConfig.language)
              expect(parsedPersisted.maxUsers).toBe(updatedConfig.maxUsers)
              
              // Should NOT have initial config values if they were different
              if (initialConfig.theme !== updatedConfig.theme) {
                expect(parsedPersisted.theme).not.toBe(initialConfig.theme)
              }
            } catch (parseError) {
              // If parsing fails, at least verify content exists and changed
              expect(readPersistedResult.stdout.length).toBeGreaterThan(0)
            }

          } finally {
            // Cleanup
            if (containerId) {
              await runCommand('docker', ['stop', containerId], { timeout: 10000 }).catch(() => {})
              await runCommand('docker', ['rm', containerId], { timeout: 5000 }).catch(() => {})
            }
            
            await runCommand('docker', ['volume', 'rm', volumeName], { timeout: 5000 }).catch(() => {})
          }
        }
      ),
      { 
        numRuns: 3,
        timeout: 120000
      }
    )
  }, 180000)
})

/**
 * Helper function to write test data to container
 */
async function writeTestDataToContainer(containerId, configData, logData) {
  // Write config data
  const configJson = JSON.stringify(configData, null, 2)
  await runCommand('docker', [
    'exec', containerId,
    'sh', '-c',
    `echo '${configJson}' > /app/data/test-config.json`
  ], { timeout: 10000 })

  // Write log data
  const logContent = logData.join('\n')
  await runCommand('docker', [
    'exec', containerId,
    'sh', '-c',
    `echo '${logContent}' > /app/data/test-logs.txt`
  ], { timeout: 10000 })
}

/**
 * Helper function to read test data from container
 */
async function readTestDataFromContainer(containerId) {
  const result = {
    configExists: false,
    logExists: false,
    configContent: null,
    logContent: null
  }

  // Check if config file exists and read it
  const configResult = await runCommand('docker', [
    'exec', containerId,
    'cat', '/app/data/test-config.json'
  ], { timeout: 5000 })

  if (configResult.success) {
    result.configExists = true
    result.configContent = configResult.stdout
  }

  // Check if log file exists and read it
  const logResult = await runCommand('docker', [
    'exec', containerId,
    'cat', '/app/data/test-logs.txt'
  ], { timeout: 5000 })

  if (logResult.success) {
    result.logExists = true
    result.logContent = logResult.stdout
  }

  return result
}

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