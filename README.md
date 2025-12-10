# Give Green, Live Clean - Donation Website

A comprehensive environmental donation website with real-time statistics, YAML-based configuration management, and Docker deployment capabilities.

## Features

- **Secure PayPal Integration**: Process donations through existing PayPal business account
- **Real-time Statistics**: Dynamic display of environmental impact metrics
- **Tab Navigation**: Organized content sections (Home, About, Impact, Donate)
- **YAML Configuration**: Easy content and settings management without code changes
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Docker Deployment**: Containerized application for consistent deployment

## Project Structure

```
├── frontend/                 # Frontend assets and code
│   ├── css/                 # Custom stylesheets
│   ├── js/                  # JavaScript modules
│   └── index.html           # Main HTML file
├── backend/                 # Node.js backend server
│   ├── config/              # Configuration management
│   ├── routes/              # API route handlers
│   └── server.js            # Express server entry point
├── config/                  # YAML configuration files
│   ├── statistics.yml       # Impact statistics data
│   ├── content.yml          # Site content and settings
│   └── settings.yml         # Application settings
├── tests/                   # Test suites
│   ├── properties/          # Property-based tests
│   ├── integration/         # Integration tests
│   └── utils/               # Test utilities
├── Dockerfile               # Docker container configuration
├── docker-compose.yml       # Docker Compose setup
└── package.json             # Node.js dependencies and scripts
```

## Prerequisites

- Node.js 16.0.0 or higher
- npm 8.0.0 or higher
- Docker (optional, for containerized deployment)

## Development Setup

1. **Clone the repository and navigate to the project directory**

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the development server:**

   ```bash
   npm run dev
   ```

4. **Access the application:**
   - Open your browser to `http://localhost:3000`

## Configuration Management

The application uses YAML files for configuration:

### Statistics Configuration (`config/statistics.yml`)

Manages impact metrics displayed on the website:

- Tree planting statistics
- Hectares restored data
- Global impact information
- Update frequency settings

### Content Configuration (`config/content.yml`)

Controls site content and PayPal settings:

- Site title and descriptions
- Tab content for different sections
- PayPal business ID and donation amounts
- UI text and messaging

### Settings Configuration (`config/settings.yml`)

Application-wide settings:

- Theme colors and responsive breakpoints
- API polling intervals and timeouts
- Environment-specific configurations

## Available Scripts

### Development

- `npm run dev` - Start development server with auto-reload
- `npm run lint` - Run ESLint code quality checks
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Testing

- `npm test` - Run all tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report
- `npm run test:properties` - Run property-based tests only

### Production

- `npm start` - Start production server
- `npm run build` - Run linting and tests before deployment

### Docker

- `npm run docker:build` - Build Docker image
- `npm run docker:run` - Start production container
- `npm run docker:dev` - Start development container
- `npm run docker:stop` - Stop all containers

## Docker Deployment

### Production Deployment

1. **Build and start the container:**

   ```bash
   npm run docker:build
   npm run docker:run
   ```

2. **Access the application:**
   - Production: `http://localhost:3000`

### Development with Docker

1. **Start development container:**

   ```bash
   npm run docker:dev
   ```

2. **Access the application:**
   - Development: `http://localhost:3001`

### Environment Variables

Configure the application using environment variables:

- `NODE_ENV` - Application environment (development/production)
- `PORT` - Server port (default: 3000)

## PayPal Integration

The application integrates with PayPal using business ID: `73PLJSAMMTSCW`

### Configuration

- Donation amounts are configurable in `config/content.yml`
- Currency settings can be modified in the same file
- Success and error handling is built into the frontend

## Real-time Updates

The application polls for configuration changes every 30 seconds by default:

- Statistics updates reflect immediately on the frontend
- Content changes apply without server restart
- Configuration validation prevents invalid updates

## Testing Strategy

The project uses a dual testing approach:

### Unit Tests

- Test specific component functionality
- Validate error conditions and edge cases
- Located alongside source files with `.test.js` suffix

### Property-Based Tests

- Verify universal properties across all inputs
- Use fast-check library for comprehensive testing
- Located in `tests/properties/` directory
- Each test runs minimum 100 iterations

## Code Quality

The project maintains high code quality standards:

- **ESLint**: Enforces consistent coding standards
- **Prettier**: Automatic code formatting
- **Jest**: Comprehensive test coverage (80% minimum)
- **JSDoc**: Documentation for all public functions

## Troubleshooting

### Common Issues

1. **Port already in use:**

   ```bash
   # Kill process using port 3000
   lsof -ti:3000 | xargs kill -9
   ```

2. **Docker container won't start:**

   ```bash
   # Check container logs
   docker-compose logs donation-website
   ```

3. **Configuration not updating:**
   - Verify YAML syntax is valid
   - Check server logs for validation errors
   - Ensure file permissions allow reading

4. **Tests failing:**
   ```bash
   # Run tests with verbose output
   npm test -- --verbose
   ```

### Performance Optimization

- Configuration files are cached and only reloaded on changes
- Static assets are served with appropriate caching headers
- Docker images use multi-stage builds for smaller size
- Health checks ensure container reliability

## Contributing

1. Follow the established coding standards (ESLint + Prettier)
2. Write tests for new functionality
3. Update documentation for API changes
4. Ensure all tests pass before submitting changes

## License

MIT License - see LICENSE file for details
