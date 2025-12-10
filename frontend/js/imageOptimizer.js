/**
 * Image Optimization and Loading System
 * Handles responsive image loading, lazy loading, and fallback management
 */
class ImageOptimizer {
    constructor(options = {}) {
        this.options = {
            // Default configuration
            lazyLoadThreshold: options.lazyLoadThreshold || 100, // pixels before viewport
            retryAttempts: options.retryAttempts || 3,
            retryDelay: options.retryDelay || 1000, // milliseconds
            fallbackImage: options.fallbackImage || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIE5vdCBBdmFpbGFibGU8L3RleHQ+PC9zdmc+',
            supportedFormats: options.supportedFormats || ['webp', 'avif', 'jpg', 'jpeg', 'png', 'gif'],
            breakpoints: options.breakpoints || {
                mobile: 480,
                tablet: 768,
                desktop: 1024,
                large: 1440
            },
            ...options
        };

        this.observer = null;
        this.imageCache = new Map();
        this.loadingImages = new Set();
        this.deviceCapabilities = this.detectDeviceCapabilities();
        
        // Bind methods to preserve context
        this.handleIntersection = this.handleIntersection.bind(this);
        this.handleImageLoad = this.handleImageLoad.bind(this);
        this.handleImageError = this.handleImageError.bind(this);
    }

    /**
     * Initialize the image optimizer
     */
    async initialize() {
        try {
            // Load configuration from backend
            await this.loadConfiguration();
            
            // Set up intersection observer for lazy loading
            this.setupIntersectionObserver();
            
            // Process existing images on the page
            await this.processExistingImages();
            
            // Set up mutation observer for dynamically added images
            this.setupMutationObserver();
            
            console.log('ImageOptimizer initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize ImageOptimizer:', error);
            return false;
        }
    }

    /**
     * Load configuration from backend API
     */
    async loadConfiguration() {
        try {
            const response = await fetch('/api/images/config');
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                    // Merge backend configuration with defaults
                    this.options = {
                        ...this.options,
                        ...data.data
                    };
                    console.log('Image optimization configuration loaded from backend');
                }
            }
        } catch (error) {
            console.warn('Failed to load image configuration from backend, using defaults:', error);
        }
    }

    /**
     * Detect device capabilities for image optimization
     */
    detectDeviceCapabilities() {
        const capabilities = {
            // Screen properties
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            devicePixelRatio: window.devicePixelRatio || 1,
            
            // Viewport properties
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            
            // Connection information (if available)
            connection: null,
            
            // Format support
            supportsWebP: false,
            supportsAvif: false,
            
            // Device type detection
            isMobile: window.innerWidth <= this.options.breakpoints.mobile,
            isTablet: window.innerWidth > this.options.breakpoints.mobile && window.innerWidth <= this.options.breakpoints.tablet,
            isDesktop: window.innerWidth > this.options.breakpoints.tablet,
            
            // Performance hints
            preferReducedData: false
        };

        // Detect connection information
        if ('connection' in navigator) {
            capabilities.connection = {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                saveData: navigator.connection.saveData || false
            };
            capabilities.preferReducedData = navigator.connection.saveData;
        }

        // Detect format support
        this.detectFormatSupport().then(formats => {
            capabilities.supportsWebP = formats.webp;
            capabilities.supportsAvif = formats.avif;
        });

        return capabilities;
    }

    /**
     * Detect browser support for modern image formats
     */
    async detectFormatSupport() {
        const formats = {
            webp: false,
            avif: false
        };

        try {
            // Test WebP support
            const webpCanvas = document.createElement('canvas');
            webpCanvas.width = 1;
            webpCanvas.height = 1;
            formats.webp = webpCanvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;

            // Test AVIF support (more complex detection)
            formats.avif = await this.testAvifSupport();
        } catch (error) {
            console.warn('Error detecting image format support:', error);
        }

        return formats;
    }

    /**
     * Test AVIF format support
     */
    testAvifSupport() {
        return new Promise((resolve) => {
            const avifImage = new Image();
            avifImage.onload = () => resolve(true);
            avifImage.onerror = () => resolve(false);
            // Minimal AVIF test image (1x1 pixel)
            avifImage.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=';
        });
    }

    /**
     * Set up intersection observer for lazy loading
     */
    setupIntersectionObserver() {
        if (!('IntersectionObserver' in window)) {
            console.warn('IntersectionObserver not supported, falling back to immediate loading');
            return;
        }

        const options = {
            root: null,
            rootMargin: `${this.options.lazyLoadThreshold}px`,
            threshold: 0.01
        };

        this.observer = new IntersectionObserver(this.handleIntersection, options);
    }

    /**
     * Set up mutation observer for dynamically added images
     */
    setupMutationObserver() {
        if (!('MutationObserver' in window)) {
            return;
        }

        const mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the added node is an image or contains images
                        const images = node.tagName === 'IMG' ? [node] : node.querySelectorAll ? node.querySelectorAll('img') : [];
                        images.forEach(img => this.processImage(img));
                    }
                });
            });
        });

        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Process existing images on the page
     */
    async processExistingImages() {
        const images = document.querySelectorAll('img');
        const promises = Array.from(images).map(img => this.processImage(img));
        await Promise.allSettled(promises);
    }

    /**
     * Process a single image element
     */
    async processImage(img) {
        if (!img || img.dataset.optimized === 'true') {
            return; // Skip if already processed
        }

        try {
            // Mark as being processed
            img.dataset.optimized = 'true';
            
            // Set up responsive attributes
            this.setupResponsiveImage(img);
            
            // Set up lazy loading if supported
            if (this.observer && !this.isInViewport(img)) {
                this.setupLazyLoading(img);
            } else {
                // Load immediately if in viewport or no intersection observer
                await this.loadImage(img);
            }
            
            // Set up error handling
            this.setupErrorHandling(img);
            
        } catch (error) {
            console.warn('Error processing image:', error);
            this.handleImageError({ target: img });
        }
    }

    /**
     * Set up responsive image attributes
     */
    setupResponsiveImage(img) {
        const originalSrc = img.src || img.dataset.src;
        if (!originalSrc) return;

        // Store original source
        if (!img.dataset.originalSrc) {
            img.dataset.originalSrc = originalSrc;
        }

        // Generate responsive sources based on device capabilities
        const responsiveSources = this.generateResponsiveSources(originalSrc);
        
        // Set appropriate source based on device
        const optimalSource = this.selectOptimalSource(responsiveSources);
        
        if (optimalSource !== originalSrc) {
            img.dataset.src = optimalSource;
            if (!img.dataset.lazyLoad) {
                img.src = optimalSource;
            }
        }

        // Add loading attribute for native lazy loading support
        if ('loading' in HTMLImageElement.prototype) {
            img.loading = 'lazy';
        }
    }

    /**
     * Generate responsive image sources
     */
    generateResponsiveSources(originalSrc) {
        const sources = {
            original: originalSrc,
            optimized: originalSrc
        };

        // For external URLs, we can't generate different sizes
        // but we can suggest format preferences
        if (this.isExternalUrl(originalSrc)) {
            return sources;
        }

        // For local images, generate different sizes and formats
        const basePath = originalSrc.replace(/\.[^/.]+$/, '');
        const extension = originalSrc.split('.').pop().toLowerCase();

        // Generate different sizes based on device capabilities
        const targetWidth = this.getTargetImageWidth();
        
        if (this.deviceCapabilities.supportsWebP) {
            sources.webp = `${basePath}.webp`;
        }
        
        if (this.deviceCapabilities.supportsAvif) {
            sources.avif = `${basePath}.avif`;
        }

        // Add size variants if needed
        if (targetWidth < this.deviceCapabilities.screenWidth) {
            sources.small = `${basePath}_small.${extension}`;
            if (sources.webp) sources.webpSmall = `${basePath}_small.webp`;
            if (sources.avif) sources.avifSmall = `${basePath}_small.avif`;
        }

        return sources;
    }

    /**
     * Select the optimal image source based on device capabilities
     */
    selectOptimalSource(sources) {
        // Prefer reduced data if connection is slow or save-data is enabled
        if (this.deviceCapabilities.preferReducedData && sources.small) {
            if (this.deviceCapabilities.supportsAvif && sources.avifSmall) {
                return sources.avifSmall;
            }
            if (this.deviceCapabilities.supportsWebP && sources.webpSmall) {
                return sources.webpSmall;
            }
            return sources.small;
        }

        // Select best format for normal conditions
        if (this.deviceCapabilities.supportsAvif && sources.avif) {
            return sources.avif;
        }
        
        if (this.deviceCapabilities.supportsWebP && sources.webp) {
            return sources.webp;
        }

        return sources.original;
    }

    /**
     * Get target image width based on device
     */
    getTargetImageWidth() {
        const { viewportWidth, devicePixelRatio, isMobile, isTablet } = this.deviceCapabilities;
        
        if (isMobile) {
            return Math.min(viewportWidth * devicePixelRatio, 800);
        }
        
        if (isTablet) {
            return Math.min(viewportWidth * devicePixelRatio, 1200);
        }
        
        return Math.min(viewportWidth * devicePixelRatio, 1920);
    }

    /**
     * Check if URL is external
     */
    isExternalUrl(url) {
        try {
            const urlObj = new URL(url, window.location.origin);
            return urlObj.origin !== window.location.origin;
        } catch {
            return false;
        }
    }

    /**
     * Set up lazy loading for an image
     */
    setupLazyLoading(img) {
        // Store the actual source in data attribute
        if (img.src && !img.dataset.src) {
            img.dataset.src = img.src;
        }
        
        // Set placeholder or remove src to prevent loading
        img.src = this.generatePlaceholder(img);
        img.dataset.lazyLoad = 'true';
        
        // Add loading class for styling
        img.classList.add('lazy-loading');
        
        // Observe the image
        if (this.observer) {
            this.observer.observe(img);
        }
    }

    /**
     * Generate a placeholder for lazy-loaded images
     */
    generatePlaceholder(img) {
        const width = img.width || img.getAttribute('width') || 300;
        const height = img.height || img.getAttribute('height') || 200;
        
        // Generate a simple SVG placeholder
        const svg = `
            <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="#f3f4f6"/>
                <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="14" fill="#9ca3af" text-anchor="middle" dy=".3em">Loading...</text>
            </svg>
        `;
        
        return `data:image/svg+xml;base64,${btoa(svg)}`;
    }

    /**
     * Handle intersection observer events
     */
    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                this.loadImage(img);
                this.observer.unobserve(img);
            }
        });
    }

    /**
     * Load an image with retry logic
     */
    async loadImage(img, attempt = 1) {
        if (this.loadingImages.has(img)) {
            return; // Already loading
        }

        this.loadingImages.add(img);
        
        try {
            const src = img.dataset.src || img.src;
            if (!src || src === this.options.fallbackImage) {
                return;
            }

            // Check cache first
            if (this.imageCache.has(src)) {
                this.applyLoadedImage(img, src);
                return;
            }

            // Validate image with backend for local images
            if (!this.isExternalUrl(src)) {
                const isValid = await this.validateImageWithBackend(src);
                if (!isValid) {
                    throw new Error('Image validation failed');
                }
            }

            // Load the image
            await this.preloadImage(src);
            
            // Cache successful load
            this.imageCache.set(src, true);
            
            // Apply the loaded image
            this.applyLoadedImage(img, src);
            
        } catch (error) {
            console.warn(`Failed to load image (attempt ${attempt}):`, error);
            
            if (attempt < this.options.retryAttempts) {
                // Retry after delay
                setTimeout(() => {
                    this.loadImage(img, attempt + 1);
                }, this.options.retryDelay * attempt);
            } else {
                // Final fallback
                this.handleImageError({ target: img });
            }
        } finally {
            this.loadingImages.delete(img);
        }
    }

    /**
     * Validate image with backend API
     */
    async validateImageWithBackend(src) {
        try {
            const response = await fetch(`/api/images/validate?url=${encodeURIComponent(src)}`);
            if (response.ok) {
                const data = await response.json();
                return data.success && data.exists;
            }
            return false;
        } catch (error) {
            console.warn('Failed to validate image with backend:', error);
            return true; // Assume valid if validation fails
        }
    }

    /**
     * Preload an image
     */
    preloadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    /**
     * Apply loaded image to element
     */
    applyLoadedImage(img, src) {
        img.src = src;
        img.classList.remove('lazy-loading');
        img.classList.add('lazy-loaded');
        
        // Remove lazy loading data
        delete img.dataset.lazyLoad;
        
        // Trigger load event for any listeners
        img.dispatchEvent(new Event('load'));
    }

    /**
     * Set up error handling for images
     */
    setupErrorHandling(img) {
        img.addEventListener('error', this.handleImageError);
        img.addEventListener('load', this.handleImageLoad);
    }

    /**
     * Handle image load success
     */
    handleImageLoad(event) {
        const img = event.target;
        img.classList.remove('image-error', 'lazy-loading');
        img.classList.add('image-loaded');
    }

    /**
     * Handle image load errors
     */
    handleImageError(event) {
        const img = event.target;
        
        // Don't replace fallback images
        if (img.src === this.options.fallbackImage) {
            return;
        }
        
        console.warn('Image failed to load:', img.src || img.dataset.src);
        
        // Apply fallback image
        img.src = this.options.fallbackImage;
        img.classList.remove('lazy-loading', 'lazy-loaded');
        img.classList.add('image-error');
        
        // Set alt text if not present
        if (!img.alt) {
            img.alt = 'Image not available';
        }
        
        // Remove from loading set
        this.loadingImages.delete(img);
    }

    /**
     * Check if element is in viewport
     */
    isInViewport(element) {
        const rect = element.getBoundingClientRect();
        const threshold = this.options.lazyLoadThreshold;
        
        return (
            rect.bottom >= -threshold &&
            rect.right >= -threshold &&
            rect.top <= (window.innerHeight || document.documentElement.clientHeight) + threshold &&
            rect.left <= (window.innerWidth || document.documentElement.clientWidth) + threshold
        );
    }

    /**
     * Refresh device capabilities (call on resize/orientation change)
     */
    refreshDeviceCapabilities() {
        this.deviceCapabilities = this.detectDeviceCapabilities();
    }

    /**
     * Manually process new images
     */
    async processNewImages(container = document) {
        const images = container.querySelectorAll('img:not([data-optimized="true"])');
        const promises = Array.from(images).map(img => this.processImage(img));
        await Promise.allSettled(promises);
    }

    /**
     * Destroy the image optimizer
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        this.imageCache.clear();
        this.loadingImages.clear();
        
        // Remove event listeners
        document.querySelectorAll('img').forEach(img => {
            img.removeEventListener('error', this.handleImageError);
            img.removeEventListener('load', this.handleImageLoad);
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageOptimizer;
} else {
    window.ImageOptimizer = ImageOptimizer;
}