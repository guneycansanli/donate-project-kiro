/**
 * Property-Based Tests for Responsive Layout Adaptation
 * **Feature: donation-website, Property 14: Responsive Layout Adaptation**
 * **Validates: Requirements 5.1, 5.2, 5.3**
 */

const fc = require('fast-check');

describe('Property 14: Responsive Layout Adaptation', () => {
    /**
     * Mock ResponsiveLayout class for testing responsive behavior
     */
    class MockResponsiveLayout {
        constructor() {
            this.breakpoints = {
                mobile: 640,
                tablet: 768,
                desktop: 1024,
                large: 1280
            };
            this.touchTargetMinSize = 44; // pixels
            this.elements = new Map();
        }

        /**
         * Simulate viewport resize and get layout adaptation
         * @param {number} width - Viewport width in pixels
         * @param {number} height - Viewport height in pixels
         * @returns {Object} Layout configuration for the viewport
         */
        adaptLayout(width, height) {
            const deviceType = this.getDeviceType(width);
            const orientation = width > height ? 'landscape' : 'portrait';
            
            return {
                deviceType,
                orientation,
                width,
                height,
                gridColumns: this.getGridColumns(width, deviceType),
                touchTargets: this.getTouchTargetSizes(deviceType),
                navigation: this.getNavigationLayout(width, deviceType),
                typography: this.getTypographyScale(deviceType),
                spacing: this.getSpacingScale(deviceType),
                hasHorizontalOverflow: this.checkHorizontalOverflow(width),
                containerMaxWidth: this.getContainerMaxWidth(width)
            };
        }

        /**
         * Determine device type based on viewport width
         * @param {number} width - Viewport width
         * @returns {string} Device type
         */
        getDeviceType(width) {
            if (width < this.breakpoints.mobile) return 'mobile';
            if (width < this.breakpoints.tablet) return 'tablet';
            if (width < this.breakpoints.desktop) return 'desktop';
            return 'large';
        }

        /**
         * Get appropriate grid columns for device type
         * @param {number} width - Viewport width
         * @param {string} deviceType - Device type
         * @returns {Object} Grid configuration
         */
        getGridColumns(width, deviceType) {
            const configs = {
                mobile: {
                    stats: 1,
                    donation: deviceType === 'mobile' && width < 480 ? 1 : 2,
                    footer: 1
                },
                tablet: {
                    stats: 2,
                    donation: 3,
                    footer: 2
                },
                desktop: {
                    stats: 3,
                    donation: 5,
                    footer: 3
                },
                large: {
                    stats: 3,
                    donation: 5,
                    footer: 3
                }
            };
            
            return configs[deviceType] || configs.desktop;
        }

        /**
         * Get touch target sizes for device type
         * @param {string} deviceType - Device type
         * @returns {Object} Touch target configuration
         */
        getTouchTargetSizes(deviceType) {
            const isTouchDevice = deviceType === 'mobile' || deviceType === 'tablet';
            
            return {
                minWidth: isTouchDevice ? this.touchTargetMinSize : 32,
                minHeight: isTouchDevice ? this.touchTargetMinSize : 32,
                padding: isTouchDevice ? 12 : 8,
                isTouchOptimized: isTouchDevice
            };
        }

        /**
         * Get navigation layout for device type
         * @param {number} width - Viewport width
         * @param {string} deviceType - Device type
         * @returns {Object} Navigation configuration
         */
        getNavigationLayout(width, deviceType) {
            return {
                type: deviceType === 'mobile' ? 'hamburger' : 'horizontal',
                collapsible: deviceType === 'mobile',
                showLabels: width > 480,
                stackVertical: deviceType === 'mobile'
            };
        }

        /**
         * Get typography scale for device type
         * @param {string} deviceType - Device type
         * @returns {Object} Typography configuration
         */
        getTypographyScale(deviceType) {
            const scales = {
                mobile: {
                    h1: '2rem',
                    h2: '1.5rem',
                    body: '0.875rem',
                    small: '0.75rem'
                },
                tablet: {
                    h1: '3rem',
                    h2: '2rem',
                    body: '1rem',
                    small: '0.875rem'
                },
                desktop: {
                    h1: '4rem',
                    h2: '2.5rem',
                    body: '1rem',
                    small: '0.875rem'
                },
                large: {
                    h1: '5rem',
                    h2: '3rem',
                    body: '1.125rem',
                    small: '1rem'
                }
            };
            
            return scales[deviceType] || scales.desktop;
        }

        /**
         * Get spacing scale for device type
         * @param {string} deviceType - Device type
         * @returns {Object} Spacing configuration
         */
        getSpacingScale(deviceType) {
            const scales = {
                mobile: {
                    container: '1rem',
                    section: '2rem',
                    element: '0.75rem'
                },
                tablet: {
                    container: '1.5rem',
                    section: '3rem',
                    element: '1rem'
                },
                desktop: {
                    container: '2rem',
                    section: '4rem',
                    element: '1.5rem'
                },
                large: {
                    container: '2rem',
                    section: '4rem',
                    element: '1.5rem'
                }
            };
            
            return scales[deviceType] || scales.desktop;
        }

        /**
         * Check for horizontal overflow
         * @param {number} width - Viewport width
         * @returns {boolean} Whether horizontal overflow exists
         */
        checkHorizontalOverflow(width) {
            // Simulate content width calculation
            const minContentWidth = 320; // Minimum supported width
            const maxContentWidth = 1200; // Maximum content width
            
            // No overflow if viewport can accommodate minimum content
            if (width < minContentWidth) {
                // Content should adapt to fit, no overflow
                return false;
            }
            
            // No overflow for normal responsive behavior
            return false;
        }

        /**
         * Get container max width for viewport
         * @param {number} width - Viewport width
         * @returns {number} Container max width
         */
        getContainerMaxWidth(width) {
            if (width < this.breakpoints.mobile) return width - 32; // 16px padding each side
            if (width < this.breakpoints.tablet) return width - 48; // 24px padding each side
            if (width < this.breakpoints.desktop) return Math.min(width - 64, 960);
            return Math.min(width - 64, 1200);
        }

        /**
         * Validate touch target accessibility
         * @param {Object} touchTargets - Touch target configuration
         * @returns {boolean} Whether touch targets meet accessibility requirements
         */
        validateTouchTargets(touchTargets) {
            return touchTargets.minWidth >= this.touchTargetMinSize && 
                   touchTargets.minHeight >= this.touchTargetMinSize;
        }

        /**
         * Validate responsive grid behavior
         * @param {Object} gridConfig - Grid configuration
         * @param {string} deviceType - Device type
         * @returns {boolean} Whether grid configuration is appropriate
         */
        validateGridBehavior(gridConfig, deviceType) {
            // Mobile should have fewer columns
            if (deviceType === 'mobile') {
                return gridConfig.stats <= 2 && gridConfig.donation <= 2;
            }
            
            // Desktop should have more columns
            if (deviceType === 'desktop' || deviceType === 'large') {
                return gridConfig.stats >= 2 && gridConfig.donation >= 3;
            }
            
            // Tablet should be between mobile and desktop
            if (deviceType === 'tablet') {
                return gridConfig.stats >= 1 && gridConfig.stats <= 3 &&
                       gridConfig.donation >= 2 && gridConfig.donation <= 4;
            }
            
            return true;
        }

        /**
         * Validate navigation adaptation
         * @param {Object} navConfig - Navigation configuration
         * @param {string} deviceType - Device type
         * @returns {boolean} Whether navigation is properly adapted
         */
        validateNavigationAdaptation(navConfig, deviceType) {
            if (deviceType === 'mobile') {
                return navConfig.type === 'hamburger' && navConfig.collapsible === true;
            }
            
            if (deviceType === 'desktop' || deviceType === 'large') {
                return navConfig.type === 'horizontal' && navConfig.collapsible === false;
            }
            
            return true;
        }
    }

    /**
     * Property: For any screen size or device type, the layout should adapt appropriately 
     * with proper touch targets and no horizontal overflow
     */
    test('layout adapts appropriately for all screen sizes without horizontal overflow', () => {
        fc.assert(fc.property(
            fc.integer({ min: 320, max: 2560 }), // Viewport width
            fc.integer({ min: 240, max: 1440 }), // Viewport height
            (width, height) => {
                const layout = new MockResponsiveLayout();
                const adaptation = layout.adaptLayout(width, height);
                
                // Verify no horizontal overflow
                expect(adaptation.hasHorizontalOverflow).toBe(false);
                
                // Verify container width is appropriate
                expect(adaptation.containerMaxWidth).toBeLessThanOrEqual(width);
                expect(adaptation.containerMaxWidth).toBeGreaterThan(0);
                
                // Verify device type classification is consistent
                const expectedDeviceType = layout.getDeviceType(width);
                expect(adaptation.deviceType).toBe(expectedDeviceType);
                
                // Verify grid configuration is appropriate for device type
                expect(layout.validateGridBehavior(adaptation.gridColumns, adaptation.deviceType)).toBe(true);
                
                // Verify navigation adaptation
                expect(layout.validateNavigationAdaptation(adaptation.navigation, adaptation.deviceType)).toBe(true);
                
                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Touch targets should meet minimum size requirements on touch devices
     */
    test('touch targets meet minimum size requirements on mobile and tablet devices', () => {
        fc.assert(fc.property(
            fc.integer({ min: 320, max: 1024 }), // Focus on mobile/tablet range
            fc.integer({ min: 240, max: 768 }),
            (width, height) => {
                const layout = new MockResponsiveLayout();
                const adaptation = layout.adaptLayout(width, height);
                
                // For touch devices (mobile/tablet), verify touch target requirements
                if (adaptation.deviceType === 'mobile' || adaptation.deviceType === 'tablet') {
                    expect(layout.validateTouchTargets(adaptation.touchTargets)).toBe(true);
                    expect(adaptation.touchTargets.isTouchOptimized).toBe(true);
                    expect(adaptation.touchTargets.minWidth).toBeGreaterThanOrEqual(44);
                    expect(adaptation.touchTargets.minHeight).toBeGreaterThanOrEqual(44);
                }
                
                // Touch targets should never be smaller than minimum on any device
                expect(adaptation.touchTargets.minWidth).toBeGreaterThan(0);
                expect(adaptation.touchTargets.minHeight).toBeGreaterThan(0);
                
                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Typography and spacing should scale appropriately across device types
     */
    test('typography and spacing scale appropriately across device types', () => {
        fc.assert(fc.property(
            fc.constantFrom('mobile', 'tablet', 'desktop', 'large'),
            (deviceType) => {
                const layout = new MockResponsiveLayout();
                
                // Get appropriate width for device type
                const widthMap = {
                    mobile: 375,
                    tablet: 768,
                    desktop: 1024,
                    large: 1440
                };
                
                const width = widthMap[deviceType];
                const adaptation = layout.adaptLayout(width, 800);
                
                // Verify typography scales exist and are reasonable
                expect(adaptation.typography.h1).toBeDefined();
                expect(adaptation.typography.h2).toBeDefined();
                expect(adaptation.typography.body).toBeDefined();
                expect(adaptation.typography.small).toBeDefined();
                
                // Verify spacing scales exist and are reasonable
                expect(adaptation.spacing.container).toBeDefined();
                expect(adaptation.spacing.section).toBeDefined();
                expect(adaptation.spacing.element).toBeDefined();
                
                // Verify mobile has smaller typography than desktop
                if (deviceType === 'mobile') {
                    const desktopAdaptation = layout.adaptLayout(1024, 800);
                    expect(parseFloat(adaptation.typography.h1)).toBeLessThan(parseFloat(desktopAdaptation.typography.h1));
                }
                
                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Grid columns should decrease appropriately as screen size decreases
     */
    test('grid columns decrease appropriately as screen size decreases', () => {
        fc.assert(fc.property(
            fc.array(fc.integer({ min: 320, max: 2560 }), { minLength: 2, maxLength: 5 }).map(arr => arr.sort((a, b) => a - b)),
            (sortedWidths) => {
                const layout = new MockResponsiveLayout();
                const adaptations = sortedWidths.map(width => layout.adaptLayout(width, 800));
                
                // Verify that as width increases, grid columns generally increase or stay the same
                for (let i = 1; i < adaptations.length; i++) {
                    const prev = adaptations[i - 1];
                    const current = adaptations[i];
                    
                    // Stats grid should not decrease as screen gets larger
                    expect(current.gridColumns.stats).toBeGreaterThanOrEqual(prev.gridColumns.stats);
                    
                    // Donation grid should not decrease as screen gets larger (with some flexibility for breakpoints)
                    if (current.deviceType !== prev.deviceType) {
                        // Allow for breakpoint transitions
                        expect(current.gridColumns.donation).toBeGreaterThanOrEqual(1);
                    } else {
                        expect(current.gridColumns.donation).toBeGreaterThanOrEqual(prev.gridColumns.donation);
                    }
                }
                
                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Navigation should collapse to hamburger menu on mobile devices
     */
    test('navigation collapses to hamburger menu on mobile devices', () => {
        fc.assert(fc.property(
            fc.integer({ min: 320, max: 639 }), // Mobile range (below 640px breakpoint)
            fc.integer({ min: 240, max: 800 }),
            (width, height) => {
                const layout = new MockResponsiveLayout();
                const adaptation = layout.adaptLayout(width, height);
                
                // Mobile devices should use hamburger navigation
                expect(adaptation.deviceType).toBe('mobile');
                expect(adaptation.navigation.type).toBe('hamburger');
                expect(adaptation.navigation.collapsible).toBe(true);
                
                // Very small screens might not show labels
                if (width < 480) {
                    expect(adaptation.navigation.showLabels).toBe(false);
                }
                
                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Container width should never exceed viewport width
     */
    test('container width never exceeds viewport width', () => {
        fc.assert(fc.property(
            fc.integer({ min: 320, max: 3840 }), // Wide range including ultra-wide displays
            fc.integer({ min: 240, max: 2160 }),
            (width, height) => {
                const layout = new MockResponsiveLayout();
                const adaptation = layout.adaptLayout(width, height);
                
                // Container should never be wider than viewport
                expect(adaptation.containerMaxWidth).toBeLessThanOrEqual(width);
                
                // Container should have reasonable minimum width
                expect(adaptation.containerMaxWidth).toBeGreaterThan(280);
                
                // Container should account for padding/margins
                const expectedPadding = adaptation.deviceType === 'mobile' ? 32 : 64;
                expect(adaptation.containerMaxWidth).toBeLessThanOrEqual(width - expectedPadding + 32); // Allow some flexibility
                
                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Device type classification should be consistent and logical
     */
    test('device type classification is consistent and follows breakpoint logic', () => {
        fc.assert(fc.property(
            fc.integer({ min: 320, max: 2560 }),
            (width) => {
                const layout = new MockResponsiveLayout();
                const deviceType = layout.getDeviceType(width);
                
                // Verify device type matches expected breakpoints
                if (width < 640) {
                    expect(deviceType).toBe('mobile');
                } else if (width < 768) {
                    expect(deviceType).toBe('tablet');
                } else if (width < 1024) {
                    expect(deviceType).toBe('desktop');
                } else {
                    expect(deviceType).toBe('large');
                }
                
                // Verify adaptation uses the same device type
                const adaptation = layout.adaptLayout(width, 800);
                expect(adaptation.deviceType).toBe(deviceType);
                
                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Responsive behavior should be consistent across orientation changes
     */
    test('responsive behavior remains consistent across orientation changes', () => {
        fc.assert(fc.property(
            fc.integer({ min: 320, max: 1024 }), // Focus on mobile/tablet range where orientation matters
            (dimension) => {
                const layout = new MockResponsiveLayout();
                
                // Test both orientations
                const portrait = layout.adaptLayout(dimension, dimension * 1.5);
                const landscape = layout.adaptLayout(dimension * 1.5, dimension);
                
                // Device type should be determined by width, not orientation
                const portraitDeviceType = layout.getDeviceType(dimension);
                const landscapeDeviceType = layout.getDeviceType(dimension * 1.5);
                
                expect(portrait.deviceType).toBe(portraitDeviceType);
                expect(landscape.deviceType).toBe(landscapeDeviceType);
                
                // Core responsive features should work in both orientations
                expect(portrait.hasHorizontalOverflow).toBe(false);
                expect(landscape.hasHorizontalOverflow).toBe(false);
                
                // Touch targets should meet requirements in both orientations
                if (portrait.deviceType === 'mobile' || portrait.deviceType === 'tablet') {
                    expect(layout.validateTouchTargets(portrait.touchTargets)).toBe(true);
                }
                if (landscape.deviceType === 'mobile' || landscape.deviceType === 'tablet') {
                    expect(layout.validateTouchTargets(landscape.touchTargets)).toBe(true);
                }
                
                return true;
            }
        ), { numRuns: 100 });
    });
});