# Contributing to LinkedIn Profile Extractor

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites
- **Node.js**: Version 18+ recommended
- **npm**: Version 9+ (comes with Node.js)
- **Git**: For version control
- **Chrome Browser**: For testing the extension

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/your-repo/linkedin-to-airtable.git
cd linkedin-to-airtable

# Install dependencies
npm install

# Run tests to verify setup
npm test

# Build the extension
npm run build:browserext
```

### Development Workflow

#### 1. Making Code Changes

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes to src/*.ts files

# Run tests
npm test

# Check TypeScript types
npm run type-check

# Run linter
npm run lint

# Fix linting issues automatically
npm run lint:fix
```

#### 2. Testing Your Changes

**Run Automated Tests:**
```bash
# Run all tests
npm test

# Run tests in watch mode (recommended during development)
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- utilities
```

**Manual Testing in Browser:**
```bash
# Build the extension
npm run build:browserext

# The extension will be in: build-browserext/

# In Chrome:
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the build-browserext/ folder
# 5. Navigate to a LinkedIn profile
# 6. Click the extension icon to test
```

#### 3. Writing Tests

When adding new functionality, always include tests:

```typescript
// tests/your-feature.test.ts
import { yourFunction } from '../src/your-module';

describe('Your Feature', () => {
  it('should do something specific', () => {
    const result = yourFunction(input);
    expect(result).toBe(expected);
  });

  it('should handle edge cases', () => {
    expect(() => yourFunction(null)).toThrow();
  });
});
```

**Test Coverage Goals:**
- New features: 100% coverage
- Bug fixes: Add test that would have caught the bug
- Refactoring: Maintain or improve existing coverage

#### 4. Code Style

This project uses:
- **TypeScript** for type safety
- **ESLint** for code quality
- **Prettier** for formatting

```bash
# Format code
npm run lint:fix

# Check types
npm run type-check
```

**Key Conventions:**
- Use `camelCase` for variables and functions
- Use `PascalCase` for classes and interfaces
- Use `UPPER_SNAKE_CASE` for constants
- Add JSDoc comments for public APIs
- Keep functions small (<50 lines when possible)
- One concept per file

## Project Structure

```
linkedin-to-airtable/
├── src/                    # Source code (TypeScript)
│   ├── main.ts            # Main application logic
│   ├── utilities.ts       # Utility functions
│   ├── schema.ts          # LinkedIn schema definitions
│   ├── templates.ts       # JSON Resume templates
│   └── diagnostic.ts      # Diagnostic tool
├── tests/                 # Test files
│   ├── setup.ts          # Test environment setup
│   └── *.test.ts         # Test files
├── browser-ext/           # Browser extension files
│   ├── manifest.json     # Extension manifest
│   ├── popup.html        # Extension popup UI
│   ├── popup.js          # Popup logic
│   └── background.js     # Background script
├── build-scripts/         # Build automation
├── docs/                  # Documentation
└── build-browserext/      # Build output (gitignored)
```

## Common Tasks

### Adding a New Utility Function

1. Add function to `src/utilities.ts`:
```typescript
export function myNewFunction(input: string): string {
  // Implementation
  return result;
}
```

2. Add tests to `tests/utilities.test.ts`:
```typescript
describe('myNewFunction', () => {
  it('should transform input correctly', () => {
    expect(myNewFunction('test')).toBe('expected');
  });
});
```

3. Run tests: `npm test`

### Fixing a Bug

1. Write a test that reproduces the bug
2. Verify the test fails
3. Fix the bug
4. Verify the test passes
5. Check no other tests broke: `npm test`

### Adding LinkedIn API Support

1. Update endpoint definitions in `src/main.ts`
2. Add parsing logic
3. Add transformation to JSON Resume format
4. Add tests with mock data
5. Update documentation

### Updating Dependencies

```bash
# Check for updates
npx npm-check-updates

# Update to latest
npx npm-check-updates -u
npm install

# Run tests to ensure nothing broke
npm test

# Check for security issues
npm audit
```

## Debugging

### Extension Issues

**View Console Logs:**
- Right-click extension icon → "Inspect popup"
- Open DevTools console on LinkedIn page
- Check Background page in chrome://extensions

**Common Issues:**
- Extension not loading: Check manifest.json syntax
- No data extracted: Check LinkedIn page structure hasn't changed
- API errors: LinkedIn may have updated their endpoints

### Test Issues

**Tests Failing:**
```bash
# Run specific test with verbose output
npm test -- --verbose your-test-name

# Run with debugging
node --inspect-brk node_modules/.bin/jest --runInBand
```

**TypeScript Errors:**
```bash
# Check all type errors
npm run type-check

# Common fix: ensure all imports have proper types
```

## Pull Request Process

### Before Submitting

- [ ] All tests pass: `npm test`
- [ ] No TypeScript errors: `npm run type-check`
- [ ] No linting errors: `npm run lint`
- [ ] Code is formatted: `npm run lint:fix`
- [ ] New features have tests
- [ ] Documentation updated if needed

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How was this tested?

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

## Testing Guidelines

### Unit Tests
- Test individual functions in isolation
- Mock external dependencies
- Focus on edge cases

### Integration Tests
- Test multiple components together
- Use realistic mock data
- Verify data flow

### Manual Testing Checklist
See [TESTING-GUIDE.md](./docs/TESTING-GUIDE.md) for comprehensive manual testing procedures.

## Architecture Notes

### Data Flow

```
LinkedIn Page
    ↓
Browser Extension (popup.js)
    ↓
Content Script (main.ts)
    ↓
API Client (voyagerFetch)
    ↓ ← Fallback to DOM extraction if API fails
Profile Parser
    ↓
JSON Resume Transformer
    ↓
Output (download or API)
```

### Key Classes/Functions

- **LinkedinToResumeJson**: Main extraction class (constructor function, to be refactored)
- **voyagerFetch**: Handles LinkedIn API requests
- **parseProfileSchema**: Extracts data from embedded JSON
- **utilities**: Helper functions (dates, URLs, etc.)

### Important Concepts

**Multi-Source Data Extraction:**
1. Try Dash API endpoint (primary)
2. Fall back to profileView endpoint (deprecated)
3. Fall back to embedded JSON in DOM
4. Graceful error handling at each step

**Localization:**
- LinkedIn profiles can be in multiple languages
- Extension detects and can switch between locales
- Use `remapNestedLocale` for multi-language data

## Resources

### Documentation
- [Technical Debt Analysis](./plan.md)
- [Modernization Summary](./MODERNIZATION-SUMMARY.md)
- [API Changes (Oct 2024)](./docs/API-CHANGES-2024.md)
- [Diagnostic Guide](./docs/DIAGNOSTIC-GUIDE.md)

### External Resources
- [JSON Resume Schema](https://jsonresume.org/schema/)
- [LinkedIn API (unofficial)](https://github.com/topics/linkedin-api)
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)

## Getting Help

- **Issues**: Check existing GitHub issues or create a new one
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Review the docs/ folder

## Code of Conduct

Be respectful, inclusive, and constructive. This is an open-source project maintained by volunteers.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

Thank you for contributing! 🎉

