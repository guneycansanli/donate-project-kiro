const request = require('supertest')
const express = require('express')

// Simple test to verify the project setup
describe('Project Setup', () => {
  test('should have basic dependencies available', () => {
    expect(express).toBeDefined()
    expect(request).toBeDefined()
  })

  test('should have environment variables accessible', () => {
    expect(process.env).toBeDefined()
  })
})
