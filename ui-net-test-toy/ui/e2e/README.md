# E2E Tests with Playwright

This directory contains end-to-end tests using Playwright for testing complex user workflows that are difficult to test with Jest and React Testing Library.

## Test Coverage

- **auth.spec.js** - Authentication flows, OAuth callbacks, login/logout
- **links.spec.js** - Links page CRUD operations and drag-and-drop
- **notes.spec.js** - Notes management and reminders
- **search.spec.js** - Search and filter functionality
- **workspace.spec.js** - Workspace switching and management

## Running Tests

```bash
# Install browsers (first time only)
npm run playwright:install

# Run all E2E tests
npm run test:e2e

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Debug tests
npm run test:e2e:debug

# Run specific test file
npx playwright test e2e/auth.spec.js

# Run tests in headed mode (see browser)
npx playwright test --headed
```

## Prerequisites

1. The application should be running:
   - Development: `http://localhost:5173` (Vite dev server)
   - Production: `http://localhost` or `https://your-domain`
2. Backend API should be available at `http://localhost:8000` or `https://your-domain:8443`
3. Authentik service should be running for auth tests

## Configuration

See `playwright.config.js` in the root directory for:

- Base URL configuration
- Browser settings
- Test timeouts
- Screenshot and trace settings

## Writing New Tests

1. Create a new `.spec.js` file in this directory
2. Import Playwright test utilities:
   ```javascript
   import { test, expect } from "@playwright/test";
   ```
3. Set up authenticated state if needed in `beforeEach`
4. Write tests using Playwright's API

## Best Practices

- Always clean up state in `beforeEach` or `afterEach`
- Use data-testid attributes for reliable element selection
- Wait for network idle when appropriate
- Use explicit waits rather than arbitrary timeouts
- Take screenshots on failure for debugging
