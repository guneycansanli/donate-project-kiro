# Property-Based Tests

This directory contains property-based tests using fast-check library.

Each test validates universal properties that should hold across all inputs as defined in the design document.

## Test Format

Each property-based test must:

- Run a minimum of 100 iterations
- Be tagged with: **Feature: donation-website, Property {number}: {property_text}**
- Reference the specific correctness property from the design document
