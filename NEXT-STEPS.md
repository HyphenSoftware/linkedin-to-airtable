# Next Steps: Phase 2 Architecture Refactoring

This document outlines the immediate next steps for continuing the modernization effort.

## Phase 1 Status: ✅ COMPLETE

All Priority P0 items are complete:
- ✅ Dependencies updated to 2024 versions
- ✅ Zero security vulnerabilities
- ✅ Testing infrastructure with Jest
- ✅ Full TypeScript migration
- ✅ 17 passing tests

## Phase 2 Goals: Architecture Refactoring

**Timeline:** 3-4 weeks  
**Priority:** P1 (High)  
**Status:** Ready to Start

### Task 1: Split Monolithic main.ts (2 weeks)

**Current Problem:**
- `src/main.ts`: 1,975 lines
- Multiple responsibilities mixed together
- Hard to test individual components
- Difficult to understand data flow

**Proposed Structure:**

```
src/
├── api/
│   ├── voyager-client.ts      # API request handler
│   ├── endpoint-config.ts     # Endpoint definitions & versioning
│   └── types.ts               # API response types
│
├── parsers/
│   ├── profile-parser.ts      # Main profile parsing
│   ├── education-parser.ts    # Education section
│   ├── experience-parser.ts   # Work experience
│   ├── skills-parser.ts       # Skills parsing
│   └── types.ts               # Parser-specific types
│
├── transformers/
│   ├── json-resume.ts         # Transform to JSON Resume format
│   └── types.ts               # Transformer types
│
├── extractors/
│   ├── dom-extractor.ts       # Extract from embedded JSON
│   ├── api-extractor.ts       # Extract from API
│   └── extractor-factory.ts  # Factory pattern for extraction
│
├── ui/
│   ├── modal-handler.ts       # UI modal interactions
│   └── progress-indicator.ts # Show extraction progress
│
├── core/
│   ├── linkedin-extractor.ts  # Main orchestrator class
│   └── config.ts              # Configuration management
│
└── utils/
    ├── date-utils.ts          # From utilities.ts
    ├── url-utils.ts           # From utilities.ts
    ├── string-utils.ts        # From utilities.ts
    └── locale-utils.ts        # From utilities.ts
```

**Step-by-Step Approach:**

1. **Week 1: Extract Utilities (Low Risk)**
   ```bash
   # Start with utilities - easiest to extract
   - Create src/utils/ directory
   - Move date functions to date-utils.ts
   - Move URL functions to url-utils.ts
   - Update imports in main.ts
   - Run tests after each move
   ```

2. **Week 2: Extract API Layer (Medium Risk)**
   ```bash
   # Extract API handling
   - Create src/api/ directory
   - Move voyagerFetch to voyager-client.ts
   - Move endpoint definitions to endpoint-config.ts
   - Add tests for API client
   - Verify build works
   ```

3. **Week 3: Extract Parsers (High Risk)**
   ```bash
   # Extract parsing logic
   - Create src/parsers/ directory
   - Start with simple parsers (education, skills)
   - Then move complex parsers (work experience)
   - Add comprehensive tests for each parser
   - Use mock LinkedIn data for tests
   ```

4. **Week 4: Extract Orchestrator (Highest Risk)**
   ```bash
   # Final refactoring
   - Create LinkedInExtractor class in core/
   - Wire up all the extracted modules
   - Comprehensive integration testing
   - Update documentation
   ```

**Testing Strategy:**
- After each extraction, run full test suite
- Add new tests for extracted modules
- Keep main functionality working at all times
- Test in actual browser extension after major changes

**Files to Create:**

Priority order (safest to riskiest):
1. `src/utils/date-utils.ts` (extract from utilities.ts)
2. `src/utils/url-utils.ts` (extract from utilities.ts)
3. `src/api/endpoint-config.ts` (extract endpoint definitions)
4. `src/api/voyager-client.ts` (extract API logic)
5. `src/parsers/profile-parser.ts` (extract profile parsing)
6. `src/core/linkedin-extractor.ts` (refactor main class)

### Task 2: Refactor to ES6 Classes (1 week)

**Current Code:**
```javascript
function LinkedinToResumeJson(OPT_debug, OPT_preferApi, OPT_getFullSkills) {
  const _this = this;
  this.profileId = this.getProfileId();
  // 1,900+ more lines...
}
```

**Target Code:**
```typescript
export interface ExtractorOptions {
  debug?: boolean;
  preferApi?: boolean;
  getFullSkills?: boolean;
  locale?: string;
}

export class LinkedInExtractor {
  private profileId: string;
  private debugMode: boolean;
  private apiClient: VoyagerClient;

  constructor(options: ExtractorOptions = {}) {
    this.debugMode = options.debug ?? false;
    this.profileId = this.getProfileId();
    this.apiClient = new VoyagerClient(options);
  }

  async extractProfile(): Promise<JsonResume> {
    // Implementation
  }

  private getProfileId(): string {
    // Implementation
  }
}
```

**Benefits:**
- Better TypeScript support
- Dependency injection for testing
- Clear public/private API
- Easier to mock in tests

**Steps:**
1. Create new class alongside old constructor
2. Migrate methods one by one
3. Add tests for new class
4. Switch over when complete
5. Remove old constructor function

### Task 3: Improve Error Handling (1 week)

**Create Error Hierarchy:**

```typescript
// src/core/errors.ts
export class LinkedInExtractorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LinkedInExtractorError';
  }
}

export class APIError extends LinkedInExtractorError {
  constructor(
    message: string,
    public statusCode: number,
    public endpoint: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class ParseError extends LinkedInExtractorError {
  constructor(
    message: string,
    public section: string,
    public data?: any
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

export class RateLimitError extends APIError {
  constructor(endpoint: string, public retryAfter?: number) {
    super(`Rate limited on ${endpoint}`, 429, endpoint);
    this.name = 'RateLimitError';
  }
}
```

**Retry Logic:**

```typescript
// src/api/retry-handler.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    backoffMs?: number;
    shouldRetry?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const backoffMs = options.backoffMs ?? 1000;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      if (options.shouldRetry && !options.shouldRetry(error)) {
        throw error;
      }
      
      // Exponential backoff
      await sleep(backoffMs * Math.pow(2, attempt));
    }
  }
  
  throw new Error('Unexpected: retry loop ended');
}
```

**Usage:**

```typescript
const profile = await withRetry(
  () => apiClient.fetchProfile(profileId),
  {
    maxRetries: 3,
    shouldRetry: (error) => error.statusCode >= 500
  }
);
```

### Task 4: Expand Test Coverage (Ongoing)

**Current:** 17 tests (utilities only)  
**Target:** 70%+ code coverage

**Test Creation Order:**

1. **Week 1: Parser Tests (High Value)**
   ```typescript
   // tests/parsers/education-parser.test.ts
   describe('EducationParser', () => {
     it('should parse education from API response', () => {
       const mockData = { /* LinkedIn API response */ };
       const result = parseEducation(mockData);
       expect(result).toMatchObject({
         institution: 'University Name',
         degree: 'Bachelor',
         startDate: '2010-09-01'
       });
     });
   });
   ```

2. **Week 2: API Client Tests**
   ```typescript
   // tests/api/voyager-client.test.ts
   describe('VoyagerClient', () => {
     it('should fetch profile with correct headers', async () => {
       // Mock fetch
       // Test request headers, error handling, retries
     });
   });
   ```

3. **Week 3: Integration Tests**
   ```typescript
   // tests/integration/extraction-flow.test.ts
   describe('Complete Extraction Flow', () => {
     it('should extract profile end-to-end', async () => {
       // Use realistic mock data
       // Test full extraction pipeline
     });
   });
   ```

4. **Week 4: Edge Cases**
   - Incomplete profiles
   - Non-English profiles
   - Rate limiting scenarios
   - Network failures

## Quick Wins (Can Do Anytime)

### 1. Add More Utility Tests (1-2 hours)
The utilities are already migrated but could use more tests:
- `remapNestedLocale` - Test multilingual data
- `companyLiPageFromCompanyUrn` - Test URL extraction
- `parseAndAttachResumeDates` - Test various date formats

### 2. Update README (30 minutes)
- Add badge for test status
- Update installation instructions
- Add "Development" section
- Link to CONTRIBUTING.md

### 3. Add GitHub Actions (1 hour)
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run type-check
      - run: npm run lint
```

### 4. Enable More ESLint Rules (2 hours)
Gradually re-enable disabled rules:
```json
{
  "rules": {
    "no-plusplus": "warn",  // Change from "off" to "warn"
    "no-underscore-dangle": "warn",
    "prefer-destructuring": "warn"
  }
}
```

## Success Criteria

Phase 2 will be considered complete when:

- [ ] `src/main.ts` is under 500 lines (down from 1,975)
- [ ] At least 5 new modules created with clear responsibilities
- [ ] Test coverage above 70%
- [ ] All core functionality converted to ES6 classes
- [ ] Consistent error handling throughout
- [ ] Build and tests passing
- [ ] Extension works in browser
- [ ] Documentation updated

## Getting Started

### Day 1: Set Up Branch
```bash
git checkout -b phase2-architecture-refactoring
npm test  # Ensure starting point is clean
```

### Day 2-3: Extract Date Utils
```bash
# Safest first step
touch src/utils/date-utils.ts
# Move date functions from utilities.ts
# Update imports
npm test  # Verify nothing broke
```

### Day 4-5: Extract URL Utils
```bash
touch src/utils/url-utils.ts
# Move URL functions
npm test
```

### Continue pattern for other modules...

## Resources

- [MODERNIZATION-SUMMARY.md](./MODERNIZATION-SUMMARY.md) - What we've accomplished
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Development guidelines
- [plan.md](./plan.md) - Original technical debt analysis
- [Refactoring Guru](https://refactoring.guru/) - Refactoring patterns

## Questions?

If you have questions about these next steps:
1. Check existing documentation
2. Look at similar refactoring examples
3. Start small and iterate
4. Test frequently

---

**Ready to start?** Begin with extracting the utilities into separate files - it's the safest and easiest first step!

