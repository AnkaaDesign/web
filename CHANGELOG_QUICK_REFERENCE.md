# Changelog Testing - Quick Reference Card

## Documents Overview

| Document | Size | Purpose |
|----------|------|---------|
| `CHANGELOG_TEST_SUITE.md` | 51KB | Complete test cases with input/output examples |
| `CHANGELOG_TEST_IMPLEMENTATION_GUIDE.md` | 14KB | Implementation guide with best practices |
| `CHANGELOG_TESTING_SUMMARY.md` | 14KB | Executive summary and roadmap |
| `CHANGELOG_TEST_DATA.sql` | 11KB | SQL script for test data setup |
| `CHANGELOG_QUICK_REFERENCE.md` | This file | Quick reference card |

---

## Test Categories at a Glance

```
CHANGELOG TESTS (35+ test cases)
│
├── 1. SIMPLE FIELDS (6 tests)
│   ├── TC-001: Single field (status)
│   ├── TC-002: Multiple fields
│   ├── TC-003: Null values
│   ├── TC-004: Enum fields
│   ├── TC-005: Date fields
│   └── TC-006: Currency/numbers
│
├── 2. COMPLEX RELATIONS (8 tests)
│   ├── TC-101: Add cuts
│   ├── TC-102: Remove cuts
│   ├── TC-103: Modify cuts
│   ├── TC-104: Batch add cuts
│   ├── TC-105: Services
│   ├── TC-106: Airbrushings
│   ├── TC-107: Logo paints
│   └── TC-108: Artworks
│
├── 3. EDGE CASES (5 tests)
│   ├── TC-201: Create (no field logs)
│   ├── TC-202: No changes
│   ├── TC-203: Batch rollback
│   ├── TC-204: Concurrent updates
│   └── TC-205: Missing userId
│
└── 4. API ENDPOINTS (6 tests)
    ├── TC-301: Fetch changelogs
    ├── TC-302: Pagination
    ├── TC-303: Filter by field
    ├── TC-304: Filter by date
    ├── TC-305: Format validation
    └── TC-306: Complex queries
```

---

## Quick Commands

### Test Execution
```bash
# Run all tests
npm run test:changelog

# Run with coverage
npm run test:changelog -- --coverage

# Run specific category
npm run test:changelog -- --testPathPattern="simple-field"
npm run test:changelog -- --testPathPattern="complex-relations"
npm run test:changelog -- --testPathPattern="edge-cases"
npm run test:changelog -- --testPathPattern="api"

# Watch mode
npm run test:changelog -- --watch
```

### Database Setup
```bash
# Load test data
psql -U postgres -d test_db -f CHANGELOG_TEST_DATA.sql

# Clean test data
npm run test:db:clean

# Reset database
npm run test:db:reset
```

---

## Test Priority Matrix

| Priority | Test ID | Description | Est. Time | Impact |
|----------|---------|-------------|-----------|--------|
| P1 | TC-001 | Status changes | 2h | Critical |
| P1 | TC-002 | Multiple fields | 3h | Critical |
| P1 | TC-101 | Add cuts | 4h | Critical |
| P1 | TC-102 | Remove cuts | 3h | Critical |
| P1 | TC-301 | Fetch API | 3h | Critical |
| P2 | TC-004 | Enum tracking | 2h | High |
| P2 | TC-005 | Date tracking | 2h | High |
| P2 | TC-302 | Pagination | 3h | High |
| P2 | TC-303 | Field filter | 2h | High |
| P2 | TC-204 | Concurrent | 4h | High |
| P3 | TC-203 | Rollback | 3h | Medium |
| P3 | TC-306 | Complex queries | 3h | Medium |
| P3 | TC-205 | System updates | 2h | Medium |

---

## Changelog Format Cheat Sheet

### Simple Update
```typescript
{
  entityType: "TASK",
  entityId: "task-id",
  action: "UPDATE",
  field: "status",
  oldValue: "PENDING",
  newValue: "IN_PRODUCTION",
  userId: "user-id",
  triggeredBy: "TASK_UPDATE"
}
```

### Relation Add
```typescript
{
  entityType: "TASK",
  entityId: "task-id",
  action: "UPDATE",
  field: "cuts",
  oldValue: [],
  newValue: [{ id: "cut-id" }],
  metadata: {
    operation: "ADD",
    cutId: "cut-id"
  }
}
```

### Batch Operation
```typescript
{
  entityType: "TASK",
  entityId: "task-id",
  action: "UPDATE",
  field: "cuts",
  metadata: {
    operation: "BATCH_ADD",
    count: 3,
    cutIds: ["id1", "id2", "id3"]
  },
  triggeredBy: "BATCH_CREATE"
}
```

---

## Common Test Patterns

### Basic Test Structure
```typescript
describe('Feature', () => {
  beforeEach(async () => {
    // Setup
    testData = await createTestData();
  });

  afterEach(async () => {
    // Cleanup
    await cleanupTestData();
  });

  it('should do something', async () => {
    // Arrange
    const input = {...};

    // Act
    await performAction(input);

    // Assert
    const result = await getResult();
    expect(result).toMatchObject({...});
  });
});
```

### Assertion Helpers
```typescript
// Check changelog exists
await expectChangelogCount({ entityId: taskId }, 1);

// Check no changelog
await expectNoChangelog({ entityId: taskId, field: 'status' });

// Match changelog
expectChangelogMatch(changelog, {
  action: 'UPDATE',
  field: 'status',
  oldValue: 'PENDING',
  newValue: 'IN_PRODUCTION'
});
```

---

## Test Data Quick Reference

### Available Test Entities

**Users**
- `test-user-1` - Regular user
- `test-user-2` - Regular user
- `test-user-system` - System user

**Tasks**
- `test-task-status` - For status tests
- `test-task-multi` - For multi-field tests
- `test-task-relations` - For relation tests
- `test-task-concurrent` - For concurrent tests
- `test-task-edge` - For edge case tests

**Customers**
- `test-customer-1` - Main test customer
- `test-customer-2` - Secondary customer

**Sectors**
- `test-sector-production` - Production sector
- `test-sector-admin` - Admin sector

**Files**
- `test-file-1` - Artwork file
- `test-file-2` - Artwork file
- `test-file-cut-1` - Cut file

---

## API Endpoints

### GET /changelogs
```bash
# Basic fetch
GET /api/changelogs?entityType=TASK&entityId=task-id

# With includes
GET /api/changelogs?entityId=task-id&include[user]=true

# With filters
GET /api/changelogs?entityId=task-id&field=status

# With pagination
GET /api/changelogs?page=2&limit=20

# Date range
GET /api/changelogs?where[createdAt][gte]=2025-10-01&where[createdAt][lte]=2025-10-06
```

### GET /changelogs/:id
```bash
# Single changelog
GET /api/changelogs/changelog-id

# With includes
GET /api/changelogs/changelog-id?include[user]=true
```

---

## Field Formatting Examples

| Field Type | Value | Formatted |
|------------|-------|-----------|
| Status (Task) | `"IN_PRODUCTION"` | "Em Produção" |
| Status (User) | `"CONTRACTED"` | "Contratado" |
| Price | `1500.50` | "R$ 1.500,50" |
| Quantity | `100` | "100 un" |
| Tax | `18.5` | "18,5%" |
| Date | `"2025-10-06T10:00:00Z"` | "06/10/2025 10:00" |
| Boolean | `true` | "Sim" |
| Null | `null` | "—" |
| Empty | `""` | "Vazio" |
| Phone | `"11999999999"` | "(11) 99999-9999" |
| CPF | `"12345678901"` | "123.456.789-01" |
| CNPJ | `"12345678000190"` | "12.345.678/0001-90" |

---

## Coverage Goals

| Metric | Target | Critical |
|--------|--------|----------|
| Line Coverage | 90%+ | 100% |
| Branch Coverage | 85%+ | 95% |
| Function Coverage | 90%+ | 100% |
| Test Count | 35+ | - |
| Pass Rate | 100% | 100% |

**Critical Paths** (Must have 100% coverage):
- Changelog creation logic
- Field comparison logic
- Relation tracking logic
- API endpoints
- Validation logic

---

## Implementation Timeline

| Week | Phase | Tasks | Hours |
|------|-------|-------|-------|
| 1 | Infrastructure | Setup, fixtures, helpers | 20 |
| 2 | Simple Fields | TC-001 to TC-006 | 25 |
| 3 | Relations | TC-101 to TC-108 | 30 |
| 4 | Edge Cases | TC-201 to TC-205 | 20 |
| 5 | API Tests | TC-301 to TC-306 | 25 |
| 6 | Integration | Performance, CI/CD | 20 |

**Total**: 140 hours (6 weeks)

---

## Troubleshooting

### Test Fails: "Changelog not found"
```bash
# Check test data loaded
psql -U postgres -d test_db -c "SELECT COUNT(*) FROM \"ChangeLog\" WHERE \"entityId\" LIKE 'test-%';"

# Reload test data
psql -U postgres -d test_db -f CHANGELOG_TEST_DATA.sql
```

### Test Fails: "Database connection error"
```bash
# Check database running
docker ps | grep postgres

# Restart database
docker-compose -f docker-compose.test.yml restart
```

### Test Fails: "Timeout"
```bash
# Increase timeout in test config
// vitest.config.ts
export default {
  testTimeout: 30000 // 30 seconds
}
```

### Coverage Too Low
```bash
# Run coverage report
npm run test:coverage

# Check uncovered lines
open coverage/lcov-report/index.html

# Add tests for uncovered paths
```

---

## Key Enums

### CHANGE_LOG_ACTION
- `CREATE`, `UPDATE`, `DELETE`
- `RESTORE`, `ROLLBACK`
- `ARCHIVE`, `UNARCHIVE`
- `ACTIVATE`, `DEACTIVATE`
- `APPROVE`, `REJECT`, `CANCEL`, `COMPLETE`
- `RESCHEDULE`
- `BATCH_CREATE`, `BATCH_UPDATE`, `BATCH_DELETE`
- `VIEW`

### CHANGE_LOG_ENTITY_TYPE
- `TASK`, `ORDER`, `ITEM`, `USER`
- `CUT`, `SERVICE`, `AIRBRUSHING`
- `CUSTOMER`, `SUPPLIER`, `SECTOR`
- `PAINT`, `PAINT_FORMULA`, `PAINT_PRODUCTION`
- `PPE_DELIVERY`, `EXTERNAL_WITHDRAWAL`
- And 50+ more...

### CHANGE_TRIGGERED_BY
- `USER_ACTION`, `SYSTEM`, `SYSTEM_GENERATED`
- `TASK_CREATE`, `TASK_UPDATE`
- `BATCH_CREATE`, `BATCH_UPDATE`, `BATCH_DELETE`, `BATCH_OPERATION`
- `SCHEDULED_JOB`, `API`, `WEBHOOK`
- And 100+ more...

---

## Useful Links

- Full Test Suite: `CHANGELOG_TEST_SUITE.md`
- Implementation Guide: `CHANGELOG_TEST_IMPLEMENTATION_GUIDE.md`
- Summary: `CHANGELOG_TESTING_SUMMARY.md`
- Test Data: `CHANGELOG_TEST_DATA.sql`

---

## Quick Tips

1. **Always clean up**: Use `afterEach` to remove test data
2. **Use descriptive names**: Test names should be clear and specific
3. **Test behavior, not implementation**: Focus on what happens, not how
4. **Isolate tests**: Each test should run independently
5. **Use helpers**: Create reusable assertion and setup functions
6. **Check coverage**: Aim for 90%+ overall, 100% for critical paths
7. **Document edge cases**: Add comments for non-obvious scenarios
8. **Performance matters**: Keep tests fast (< 30s total)

---

## Contact & Support

For issues or questions:
1. Check the implementation guide
2. Review test examples
3. Examine source code
4. Test in isolation
5. Check database state

**Created**: October 6, 2025
**Version**: 1.0
**Status**: Ready for implementation
