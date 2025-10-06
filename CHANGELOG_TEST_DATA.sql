-- =====================================================
-- CHANGELOG TEST DATA
-- Sample data for testing changelog functionality
-- =====================================================

-- Clean existing test data
DELETE FROM "ChangeLog" WHERE "entityId" LIKE 'test-%';
DELETE FROM "Cut" WHERE "taskId" LIKE 'test-%';
DELETE FROM "ServiceOrder" WHERE "taskId" LIKE 'test-%';
DELETE FROM "Airbrushing" WHERE "taskId" LIKE 'test-%';
DELETE FROM "Task" WHERE id LIKE 'test-%';
DELETE FROM "Customer" WHERE id LIKE 'test-%';
DELETE FROM "Sector" WHERE id LIKE 'test-%';
DELETE FROM "User" WHERE id LIKE 'test-%';

-- =====================================================
-- USERS
-- =====================================================

INSERT INTO "User" (
  id, name, email, cpf, phone, status, "statusOrder",
  "positionId", "sectorId", "createdAt", "updatedAt"
) VALUES
  (
    'test-user-1',
    'Test User 1',
    'testuser1@example.com',
    '12345678901',
    '11999999991',
    'CONTRACTED',
    2,
    NULL,
    NULL,
    NOW(),
    NOW()
  ),
  (
    'test-user-2',
    'Test User 2',
    'testuser2@example.com',
    '12345678902',
    '11999999992',
    'CONTRACTED',
    2,
    NULL,
    NULL,
    NOW(),
    NOW()
  ),
  (
    'test-user-system',
    'System User',
    'system@example.com',
    '12345678903',
    '11999999993',
    'CONTRACTED',
    2,
    NULL,
    NULL,
    NOW(),
    NOW()
  );

-- =====================================================
-- SECTORS
-- =====================================================

INSERT INTO "Sector" (
  id, name, privileges, "createdAt", "updatedAt"
) VALUES
  (
    'test-sector-production',
    'Test Production',
    'PRODUCTION',
    NOW(),
    NOW()
  ),
  (
    'test-sector-admin',
    'Test Admin',
    'ADMIN',
    NOW(),
    NOW()
  );

-- =====================================================
-- CUSTOMERS
-- =====================================================

INSERT INTO "Customer" (
  id, "fantasyName", "corporateName", cnpj, email, phone,
  "createdAt", "updatedAt"
) VALUES
  (
    'test-customer-1',
    'Test Customer Inc',
    'Test Customer Corporation',
    '12345678000190',
    'customer1@test.com',
    '1199999991',
    NOW(),
    NOW()
  ),
  (
    'test-customer-2',
    'Sample Client Ltd',
    'Sample Client Limited',
    '98765432000190',
    'customer2@test.com',
    '1199999992',
    NOW(),
    NOW()
  );

-- =====================================================
-- TASKS
-- =====================================================

INSERT INTO "Task" (
  id, name, status, "statusOrder", commission,
  "serialNumber", plate, details, "entryDate", term,
  price, "customerId", "sectorId", "createdById",
  "createdAt", "updatedAt"
) VALUES
  -- Task for status change tests
  (
    'test-task-status',
    'Task for Status Testing',
    'PENDING',
    0,
    'NO_COMMISSION',
    'SN-001',
    'ABC-1234',
    'Test task for status changes',
    NOW(),
    NOW() + INTERVAL '7 days',
    1000.00,
    'test-customer-1',
    'test-sector-production',
    'test-user-1',
    NOW(),
    NOW()
  ),
  -- Task for multiple field updates
  (
    'test-task-multi',
    'Task for Multi-Field Testing',
    'PENDING',
    0,
    'NO_COMMISSION',
    'SN-002',
    'XYZ-5678',
    'Test task for multiple field updates',
    NOW(),
    NOW() + INTERVAL '10 days',
    1500.00,
    'test-customer-1',
    'test-sector-production',
    'test-user-1',
    NOW(),
    NOW()
  ),
  -- Task for relations tests
  (
    'test-task-relations',
    'Task for Relations Testing',
    'IN_PRODUCTION',
    1,
    'NO_COMMISSION',
    'SN-003',
    'DEF-9012',
    'Test task for relation changes',
    NOW(),
    NOW() + INTERVAL '14 days',
    2000.00,
    'test-customer-2',
    'test-sector-production',
    'test-user-2',
    NOW(),
    NOW()
  ),
  -- Task for concurrent updates
  (
    'test-task-concurrent',
    'Task for Concurrent Testing',
    'PENDING',
    0,
    'NO_COMMISSION',
    'SN-004',
    'GHI-3456',
    'Test task for concurrent updates',
    NOW(),
    NOW() + INTERVAL '5 days',
    500.00,
    'test-customer-2',
    'test-sector-production',
    'test-user-1',
    NOW(),
    NOW()
  ),
  -- Task for edge cases
  (
    'test-task-edge',
    'Task for Edge Case Testing',
    'PENDING',
    0,
    'NO_COMMISSION',
    'SN-005',
    'JKL-7890',
    'Test task for edge cases',
    NOW(),
    NOW() + INTERVAL '3 days',
    750.00,
    'test-customer-1',
    'test-sector-admin',
    'test-user-2',
    NOW(),
    NOW()
  );

-- =====================================================
-- INITIAL CHANGELOGS
-- (Simulating task creation changelogs)
-- =====================================================

INSERT INTO "ChangeLog" (
  id, "entityType", "entityId", action, field,
  "oldValue", "newValue", reason, metadata,
  "userId", "triggeredBy", "triggeredById",
  "createdAt", "updatedAt"
) VALUES
  -- Create log for test-task-status
  (
    'test-changelog-create-1',
    'TASK',
    'test-task-status',
    'CREATE',
    NULL,
    NULL,
    NULL,
    NULL,
    '{"initialState": {"name": "Task for Status Testing", "status": "PENDING"}}'::jsonb,
    'test-user-1',
    'TASK_CREATE',
    NULL,
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '1 hour'
  ),
  -- Create log for test-task-multi
  (
    'test-changelog-create-2',
    'TASK',
    'test-task-multi',
    'CREATE',
    NULL,
    NULL,
    NULL,
    NULL,
    '{"initialState": {"name": "Task for Multi-Field Testing", "status": "PENDING"}}'::jsonb,
    'test-user-1',
    'TASK_CREATE',
    NULL,
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '2 hours'
  ),
  -- Create log for test-task-relations
  (
    'test-changelog-create-3',
    'TASK',
    'test-task-relations',
    'CREATE',
    NULL,
    NULL,
    NULL,
    NULL,
    '{"initialState": {"name": "Task for Relations Testing", "status": "PENDING"}}'::jsonb,
    'test-user-2',
    'TASK_CREATE',
    NULL,
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '3 hours'
  ),
  -- Status update log for test-task-relations (PENDING -> IN_PRODUCTION)
  (
    'test-changelog-status-1',
    'TASK',
    'test-task-relations',
    'UPDATE',
    'status',
    '"PENDING"'::jsonb,
    '"IN_PRODUCTION"'::jsonb,
    NULL,
    NULL,
    'test-user-2',
    'TASK_UPDATE',
    NULL,
    NOW() - INTERVAL '2 hours 30 minutes',
    NOW() - INTERVAL '2 hours 30 minutes'
  );

-- =====================================================
-- FILES FOR TESTING
-- =====================================================

INSERT INTO "File" (
  id, filename, "originalName", mimetype, path, size,
  "createdAt", "updatedAt"
) VALUES
  (
    'test-file-1',
    'test-artwork-1.svg',
    'artwork-1.svg',
    'image/svg+xml',
    '/uploads/test/artwork-1.svg',
    1024,
    NOW(),
    NOW()
  ),
  (
    'test-file-2',
    'test-artwork-2.svg',
    'artwork-2.svg',
    'image/svg+xml',
    '/uploads/test/artwork-2.svg',
    2048,
    NOW(),
    NOW()
  ),
  (
    'test-file-cut-1',
    'test-cut-file-1.svg',
    'cut-file-1.svg',
    'image/svg+xml',
    '/uploads/test/cut-file-1.svg',
    512,
    NOW(),
    NOW()
  );

-- =====================================================
-- CUTS FOR TESTING
-- =====================================================

INSERT INTO "Cut" (
  id, type, "fileId", "taskId", origin, status, "statusOrder",
  "startedAt", "completedAt", "createdAt", "updatedAt"
) VALUES
  (
    'test-cut-1',
    'VINYL',
    'test-file-cut-1',
    'test-task-relations',
    'PLAN',
    'PENDING',
    0,
    NULL,
    NULL,
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '1 hour'
  ),
  (
    'test-cut-2',
    'STENCIL',
    'test-file-cut-1',
    'test-task-relations',
    'PLAN',
    'PENDING',
    0,
    NULL,
    NULL,
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '30 minutes'
  );

-- =====================================================
-- SERVICES FOR TESTING
-- =====================================================

INSERT INTO "ServiceOrder" (
  id, name, price, description, status, "statusOrder",
  "taskId", "createdAt", "updatedAt"
) VALUES
  (
    'test-service-1',
    'Custom Paint Service',
    500.00,
    'Custom painting service',
    'PENDING',
    0,
    'test-task-relations',
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '1 hour'
  );

-- =====================================================
-- AIRBRUSHINGS FOR TESTING
-- =====================================================

INSERT INTO "Airbrushing" (
  id, details, price, status, "statusOrder",
  "taskId", "createdAt", "updatedAt"
) VALUES
  (
    'test-airbrushing-1',
    'Custom airbrushing design',
    800.00,
    'PENDING',
    0,
    'test-task-relations',
    NOW() - INTERVAL '45 minutes',
    NOW() - INTERVAL '45 minutes'
  );

-- =====================================================
-- SAMPLE CHANGELOG ENTRIES FOR API TESTING
-- =====================================================

-- Generate multiple changelog entries for pagination testing
INSERT INTO "ChangeLog" (
  id, "entityType", "entityId", action, field,
  "oldValue", "newValue", reason, metadata,
  "userId", "triggeredBy", "triggeredById",
  "createdAt", "updatedAt"
)
SELECT
  'test-changelog-' || generate_series || '-' || field,
  'TASK',
  'test-task-status',
  'UPDATE',
  field,
  CASE
    WHEN field = 'price' THEN to_jsonb(1000.00 + (generate_series * 100))
    WHEN field = 'status' THEN to_jsonb('PENDING')
    ELSE NULL
  END,
  CASE
    WHEN field = 'price' THEN to_jsonb(1100.00 + (generate_series * 100))
    WHEN field = 'status' THEN to_jsonb('IN_PRODUCTION')
    ELSE NULL
  END,
  NULL,
  NULL,
  'test-user-1',
  'TASK_UPDATE',
  NULL,
  NOW() - (generate_series || ' minutes')::INTERVAL,
  NOW() - (generate_series || ' minutes')::INTERVAL
FROM generate_series(1, 25) AS generate_series,
     (VALUES ('price'), ('status')) AS fields(field);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify test users
-- SELECT id, name, email, status FROM "User" WHERE id LIKE 'test-%';

-- Verify test tasks
-- SELECT id, name, status, "serialNumber", plate, price FROM "Task" WHERE id LIKE 'test-%';

-- Verify test changelogs
-- SELECT
--   id,
--   "entityType",
--   "entityId",
--   action,
--   field,
--   "oldValue",
--   "newValue",
--   "userId",
--   "createdAt"
-- FROM "ChangeLog"
-- WHERE "entityId" LIKE 'test-%'
-- ORDER BY "createdAt" DESC
-- LIMIT 10;

-- Count changelogs per task
-- SELECT
--   "entityId",
--   COUNT(*) as changelog_count
-- FROM "ChangeLog"
-- WHERE "entityId" LIKE 'test-%'
-- GROUP BY "entityId"
-- ORDER BY changelog_count DESC;

-- =====================================================
-- CLEANUP SCRIPT
-- =====================================================

-- Uncomment to clean all test data:
/*
DELETE FROM "ChangeLog" WHERE "entityId" LIKE 'test-%';
DELETE FROM "Cut" WHERE id LIKE 'test-%';
DELETE FROM "ServiceOrder" WHERE id LIKE 'test-%';
DELETE FROM "Airbrushing" WHERE id LIKE 'test-%';
DELETE FROM "Task" WHERE id LIKE 'test-%';
DELETE FROM "File" WHERE id LIKE 'test-%';
DELETE FROM "Customer" WHERE id LIKE 'test-%';
DELETE FROM "Sector" WHERE id LIKE 'test-%';
DELETE FROM "User" WHERE id LIKE 'test-%';
*/
