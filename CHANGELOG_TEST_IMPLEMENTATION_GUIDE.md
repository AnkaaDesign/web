# Changelog Test Implementation Guide

## Quick Reference

### Test Files Structure
```
/tests
  /changelog
    /simple-fields
      - status.test.ts
      - multiple-fields.test.ts
      - null-values.test.ts
      - enums.test.ts
      - dates.test.ts
      - currency-numbers.test.ts
    /complex-relations
      - cuts.test.ts
      - services.test.ts
      - airbrushings.test.ts
      - logo-paints.test.ts
      - artworks.test.ts
    /edge-cases
      - creation.test.ts
      - no-changes.test.ts
      - rollback.test.ts
      - concurrent.test.ts
      - system-updates.test.ts
    /api
      - fetch.test.ts
      - pagination.test.ts
      - filters.test.ts
      - validation.test.ts
    /fixtures
      - changelog.fixtures.ts
      - task.fixtures.ts
    /helpers
      - assertions.ts
      - generators.ts
      - setup.ts
```

---

## Implementation Checklist

### Phase 1: Basic Infrastructure (Week 1)
- [ ] Set up test database configuration
- [ ] Create test fixtures for common entities (User, Task, Customer, Sector)
- [ ] Implement cleanup utilities
- [ ] Set up test environment variables
- [ ] Configure test runner (Jest/Vitest)
- [ ] Create basic assertion helpers

### Phase 2: Simple Field Tests (Week 2)
- [ ] TC-001: Single field update (status)
- [ ] TC-002: Multiple fields update
- [ ] TC-003: Null values handling
- [ ] TC-004: Enum fields tracking
- [ ] TC-005: Date fields tracking
- [ ] TC-006: Currency/number fields tracking

### Phase 3: Complex Relations Tests (Week 3)
- [ ] TC-101: Add cuts to task
- [ ] TC-102: Remove cuts from task
- [ ] TC-103: Modify existing cuts
- [ ] TC-104: Batch add cuts
- [ ] TC-105: Services relations
- [ ] TC-106: Airbrushings relations
- [ ] TC-107: Logo paints relations
- [ ] TC-108: Artworks relations

### Phase 4: Edge Cases (Week 4)
- [ ] TC-201: Create without field changelogs
- [ ] TC-202: No actual changes
- [ ] TC-203: Batch rollback
- [ ] TC-204: Concurrent updates
- [ ] TC-205: Missing userId

### Phase 5: API Tests (Week 5)
- [ ] TC-301: Fetch changelogs
- [ ] TC-302: Pagination
- [ ] TC-303: Filter by field
- [ ] TC-304: Filter by date range
- [ ] TC-305: Format validation
- [ ] TC-306: Complex queries

### Phase 6: Integration & Performance (Week 6)
- [ ] Integration tests with real backend
- [ ] Performance tests for large datasets
- [ ] Stress tests for concurrent operations
- [ ] CI/CD pipeline integration
- [ ] Test coverage reporting

---

## Critical Test Scenarios

### Priority 1 (Must Have)
1. **Status Change Tracking** (TC-001)
   - Most common operation
   - Critical for audit trail

2. **Multiple Fields Update** (TC-002)
   - Common in form submissions
   - Ensures all changes are tracked

3. **Relations: Cuts** (TC-101, TC-102)
   - Core business logic
   - Complex array manipulation

4. **API: Fetch Changelogs** (TC-301)
   - Primary user-facing feature
   - Must be performant

5. **No Changes Update** (TC-202)
   - Prevents unnecessary changelog entries
   - Performance optimization

### Priority 2 (Should Have)
1. **Enum Tracking** (TC-004)
2. **Date Tracking** (TC-005)
3. **Pagination** (TC-302)
4. **Filter by Field** (TC-303)
5. **Concurrent Updates** (TC-204)

### Priority 3 (Nice to Have)
1. **Rollback** (TC-203)
2. **Complex Queries** (TC-306)
3. **System Updates** (TC-205)

---

## Sample Test Implementation

### Example: Status Change Test
```typescript
// tests/changelog/simple-fields/status.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanupTestData, createTestTask, createTestUser } from '../../helpers/setup';
import { updateTask } from '../../../src/api-client/task';
import { getChangeLogs } from '../../../src/api-client/changelog';
import { TASK_STATUS, CHANGE_LOG_ACTION, CHANGE_LOG_ENTITY_TYPE } from '../../../src/constants';

describe('Changelog - Status Field Update', () => {
  let testTask;
  let testUser;

  beforeEach(async () => {
    testUser = await createTestUser({ name: 'Test User' });
    testTask = await createTestTask({
      name: 'Test Task',
      status: TASK_STATUS.PENDING,
      createdById: testUser.id
    });
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it('should create changelog when status is updated', async () => {
    // Act
    await updateTask(testTask.id, {
      status: TASK_STATUS.IN_PRODUCTION
    }, testUser.id);

    // Assert
    const changelogs = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: testTask.id,
        field: 'status'
      }
    });

    expect(changelogs.data).toHaveLength(1);
    expect(changelogs.data[0]).toMatchObject({
      entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
      entityId: testTask.id,
      action: CHANGE_LOG_ACTION.UPDATE,
      field: 'status',
      oldValue: TASK_STATUS.PENDING,
      newValue: TASK_STATUS.IN_PRODUCTION,
      userId: testUser.id
    });
  });

  it('should format status values correctly', async () => {
    // Act
    await updateTask(testTask.id, {
      status: TASK_STATUS.COMPLETED
    }, testUser.id);

    // Assert
    const changelogs = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: testTask.id,
        field: 'status'
      }
    });

    const changelog = changelogs.data[0];
    expect(changelog.oldValue).toBe(TASK_STATUS.PENDING);
    expect(changelog.newValue).toBe(TASK_STATUS.COMPLETED);

    // Verify formatting function
    const formatted = formatFieldValue(
      changelog.newValue,
      'status',
      CHANGE_LOG_ENTITY_TYPE.TASK
    );
    expect(formatted).toBe('Concluído');
  });
});
```

---

## Testing Best Practices

### 1. Test Isolation
```typescript
// Good: Each test is independent
beforeEach(async () => {
  testData = await createTestData();
});

afterEach(async () => {
  await cleanupTestData();
});

// Bad: Tests depend on each other
let sharedTask;
it('creates task', () => {
  sharedTask = createTask();
});
it('updates task', () => {
  updateTask(sharedTask.id); // Depends on previous test
});
```

### 2. Descriptive Test Names
```typescript
// Good
it('should create changelog when task status changes from PENDING to IN_PRODUCTION', async () => {});

// Bad
it('status test', async () => {});
```

### 3. Arrange-Act-Assert Pattern
```typescript
it('should track price changes', async () => {
  // Arrange
  const task = await createTestTask({ price: 1000 });
  const newPrice = 2000;

  // Act
  await updateTask(task.id, { price: newPrice });

  // Assert
  const changelog = await getLatestChangelog(task.id, 'price');
  expect(changelog.newValue).toBe(newPrice);
});
```

### 4. Test Data Builders
```typescript
// Good: Use builders for complex objects
const task = await taskBuilder()
  .withStatus(TASK_STATUS.PENDING)
  .withPrice(1000)
  .withCustomer(customer)
  .build();

// Bad: Manual object creation everywhere
const task = await createTask({
  name: 'Task',
  status: TASK_STATUS.PENDING,
  price: 1000,
  customerId: customer.id,
  sectorId: sector.id,
  // ... many more fields
});
```

### 5. Async/Await Handling
```typescript
// Good: Proper async handling
it('should handle async updates', async () => {
  await updateTask(taskId, updates);
  const changelog = await getChangeLogs();
  expect(changelog.data).toBeDefined();
});

// Bad: Missing await
it('should handle updates', async () => {
  updateTask(taskId, updates); // Missing await!
  const changelog = await getChangeLogs();
  // Test may fail intermittently
});
```

---

## Performance Benchmarks

### Expected Timings
- Simple field update: < 50ms
- Complex relation update: < 150ms
- Batch update (10 items): < 500ms
- API fetch (20 records): < 100ms
- Date range query (1000 records): < 300ms

### Performance Test Example
```typescript
describe('Changelog Performance', () => {
  it('should handle 100 concurrent updates efficiently', async () => {
    const startTime = Date.now();

    const updates = Array.from({ length: 100 }, (_, i) =>
      updateTask(taskId, { price: i * 100 })
    );

    await Promise.all(updates);

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(5000); // Should complete in < 5s
  });
});
```

---

## Common Pitfalls to Avoid

### 1. Not Cleaning Up Test Data
```typescript
// Problem: Tests fail on second run
it('creates task', async () => {
  const task = await createTask({ id: 'fixed-id' });
  // No cleanup - duplicate key on second run
});

// Solution: Use cleanup
afterEach(async () => {
  await cleanupTestData();
});
```

### 2. Hard-Coded IDs
```typescript
// Problem: Flaky tests
it('fetches changelog', async () => {
  const changelog = await getChangelogById('abc-123'); // May not exist
});

// Solution: Create test data
it('fetches changelog', async () => {
  const changelog = await createTestChangelog();
  const fetched = await getChangelogById(changelog.id);
});
```

### 3. Testing Implementation Instead of Behavior
```typescript
// Problem: Tests internal implementation
it('should call createChangelog function', async () => {
  const spy = jest.spyOn(service, 'createChangelog');
  await updateTask(taskId, updates);
  expect(spy).toHaveBeenCalled(); // Brittle
});

// Solution: Test behavior
it('should create changelog when task is updated', async () => {
  await updateTask(taskId, updates);
  const changelogs = await getChangeLogs({ entityId: taskId });
  expect(changelogs.data).toHaveLength(1); // Tests actual behavior
});
```

### 4. Overly Complex Tests
```typescript
// Problem: Test does too much
it('should handle all operations', async () => {
  // Creates 10 different scenarios
  // Tests 20 different conditions
  // 100+ lines of code
});

// Solution: Split into focused tests
it('should create changelog on status change', async () => {});
it('should create changelog on price change', async () => {});
it('should create changelog on customer change', async () => {});
```

---

## Debugging Failed Tests

### 1. Enable Verbose Logging
```typescript
// In test setup
process.env.LOG_LEVEL = 'debug';
```

### 2. Use Test-Specific Snapshots
```typescript
it('should match changelog format', async () => {
  const changelog = await getChangelog();
  expect(changelog).toMatchSnapshot();
});
```

### 3. Isolate Failing Test
```typescript
// Use .only to run single test
it.only('failing test', async () => {
  // Debug this specific test
});
```

### 4. Check Database State
```typescript
it('should create changelog', async () => {
  await updateTask(taskId, updates);

  // Debug: Check actual database state
  const dbChangelog = await prisma.changeLog.findMany({
    where: { entityId: taskId }
  });
  console.log('DB State:', dbChangelog);

  // Continue with assertions
});
```

---

## CI/CD Integration

### GitHub Actions Example
```yaml
# .github/workflows/test-changelog.yml
name: Changelog Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npm run migrate:test
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test_db

      - name: Run changelog tests
        run: npm run test:changelog -- --coverage
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test_db

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## Test Coverage Goals

### Coverage Targets
- **Line Coverage**: > 90%
- **Branch Coverage**: > 85%
- **Function Coverage**: > 90%

### Critical Paths (100% Coverage Required)
1. Changelog creation logic
2. Field comparison logic
3. Relation tracking logic
4. API endpoints
5. Validation logic

### Reporting
```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html

# Check coverage thresholds
npm run test:coverage -- --threshold=90
```

---

## Next Steps

1. **Set up test infrastructure** (setup.ts, fixtures, helpers)
2. **Implement Priority 1 tests** (Status, Multiple Fields, Cuts, Fetch API)
3. **Add remaining simple field tests**
4. **Complete complex relations tests**
5. **Implement edge cases**
6. **Complete API tests**
7. **Add performance tests**
8. **Integrate with CI/CD**
9. **Achieve 90%+ coverage**
10. **Document any edge cases discovered during testing**

---

## Resources

### Documentation
- `/Users/kennedycampos/Documents/repositories/web/CHANGELOG_TEST_SUITE.md` - Full test suite
- `/Users/kennedycampos/Documents/repositories/web/src/types/changelog.ts` - Type definitions
- `/Users/kennedycampos/Documents/repositories/web/src/schemas/changelog.ts` - Validation schemas
- `/Users/kennedycampos/Documents/repositories/web/src/utils/changelog-fields.ts` - Field formatting

### Key Files to Reference
- `/Users/kennedycampos/Documents/repositories/web/src/api-client/changelog.ts` - API client
- `/Users/kennedycampos/Documents/repositories/web/src/constants/enums.ts` - Enums
- `/Users/kennedycampos/Documents/repositories/web/src/types/task.ts` - Task types

### Testing Tools
- Vitest/Jest - Test runner
- @faker-js/faker - Test data generation
- supertest - API testing
- @testing-library/react - Component testing (if needed)
