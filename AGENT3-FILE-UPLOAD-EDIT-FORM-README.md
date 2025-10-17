# Agent 3: File Upload Testing (Edit Form)

## Test Overview

This test suite comprehensively tests file upload functionality in the EDIT form for tasks at https://test.ankaa.live.

**Test File**: `/home/kennedy/repositories/web/tests/agent3-file-upload-edit-form.spec.ts`

## Prerequisites

1. **Network Access**: Ensure you can reach `https://test.ankaa.live`
2. **Test Credentials**:
   - Email: `kennedy.ankaa@gmail.com`
   - Password: `abc123456`
3. **Existing Tasks**: The tests require at least one existing task in `/producao/cronograma`

## Running the Tests

### Basic Run
```bash
cd /home/kennedy/repositories/web
BASE_URL=https://test.ankaa.live npx playwright test agent3-file-upload-edit-form.spec.ts
```

### Run with UI Mode (Recommended for debugging)
```bash
cd /home/kennedy/repositories/web
BASE_URL=https://test.ankaa.live npx playwright test agent3-file-upload-edit-form.spec.ts --ui
```

### Run in Headed Mode (See the browser)
```bash
cd /home/kennedy/repositories/web
HEADLESS=false BASE_URL=https://test.ankaa.live npx playwright test agent3-file-upload-edit-form.spec.ts
```

## Test Scenarios

### Test 1: Adding Files to Existing Task
**Purpose**: Verify that new files can be added to existing tasks without replacing existing files.

**Steps**:
1. Navigate to `/producao/cronograma`
2. Open the first available task for editing
3. Check for existing files in all fields
4. Add NEW files to each field:
   - Budget (Orçamento)
   - Invoice (Nota Fiscal)
   - Receipt (Recibo)
   - Artwork (Artes)
5. Verify submit button becomes ENABLED
6. Submit the form
7. Re-open the task
8. Verify ALL files are present (old + new)

**Critical Checks**:
- Submit button must be ENABLED after adding files
- File counts should increase or stay the same (never decrease)
- Existing files should NOT be replaced

**Expected Issues to Watch For**:
- Submit button remains disabled after file selection
- Existing files disappear after adding new ones
- Files don't persist after save

---

### Test 2: Replacing Files
**Purpose**: Verify that files can be removed and replaced.

**Steps**:
1. Edit a task that has existing files
2. Click the delete/remove button on an existing file
3. Add a new file in its place
4. Verify submit button is ENABLED
5. Submit the form
6. Verify the replacement worked

**Critical Checks**:
- Delete buttons should be present and functional
- Submit button must be ENABLED after replacement
- Only the replaced file should change

**Expected Issues to Watch For**:
- No delete/remove buttons visible
- Submit button disabled after file replacement
- All files removed instead of just one

---

### Test 3: Mixed Updates (Text + Files)
**Purpose**: Verify that text field changes and file uploads can be done together.

**Steps**:
1. Edit a task
2. Change a text field (e.g., name or observation)
3. Add a new file
4. Verify submit button is ENABLED
5. Submit the form
6. Re-open and verify BOTH changes persisted

**Critical Checks**:
- Submit button enabled after both changes
- Text changes AND file uploads both persist
- No data loss on either type of change

**Expected Issues to Watch For**:
- One change type overwrites the other
- Submit button behavior inconsistent
- Data not persisting correctly

---

### Test 4: File-Only Updates (MOST CRITICAL TEST)
**Purpose**: Verify that files can be uploaded WITHOUT changing any text fields.

**Steps**:
1. Edit a task
2. DO NOT change ANY text fields
3. ONLY add a new file
4. Verify submit button is ENABLED (CRITICAL!)
5. Submit the form
6. Verify file was uploaded
7. Verify no text fields were affected

**Critical Checks**:
- Submit button MUST be enabled with file-only changes
- File uploads without text changes
- No unintended changes to other fields

**Expected Issues to Watch For**:
- **CRITICAL BUG**: Submit button disabled when ONLY files are changed
- This is a common form validation issue
- Files don't save without text field changes
- Text fields unexpectedly change

**Why This Test Is Critical**:
This test identifies a common UX bug where forms only detect "changes" on text fields, not file inputs. If this fails, users cannot upload files to existing tasks without making dummy text changes.

---

### Test 5: Navigation Test with Files
**Purpose**: Verify that unsaved file selections are properly cleared on navigation.

**Steps**:
1. Edit a task
2. Add new files
3. Navigate away WITHOUT submitting
4. Navigate back to the task
5. Verify files are NOT still there

**Critical Checks**:
- File inputs should be cleared after navigation
- No phantom file uploads
- Server-side file count unchanged

**Expected Issues to Watch For**:
- Files persist in form after navigation (UI bug)
- Files accidentally saved without submit
- Confusing UX with stale file selections

---

## File Upload Field Selectors

The test uses these selectors to locate file inputs:

```typescript
const FILE_SELECTORS = {
  orcamento: 'input[name="orcamentos"]',      // Budget files
  notaFiscal: 'input[name="notas_fiscais"]',  // Invoice files
  recibo: 'input[name="recibos"]',            // Receipt files
  artes: 'input[name="artes"]',               // Artwork files
};
```

If these selectors don't match your application, update them in the test file.

## Test Fixtures

The test automatically creates sample files in `/home/kennedy/repositories/web/tests/fixtures/`:

- `sample-budget.pdf` / `sample-budget-2.pdf`
- `sample-invoice.pdf` / `sample-invoice-2.pdf`
- `sample-receipt.pdf` / `sample-receipt-2.pdf`
- `sample-artwork.jpg` / `sample-artwork-2.jpg`

These are minimal valid PDF and JPEG files used for upload testing.

## Output Files

### Test Report
**Location**: `/home/kennedy/repositories/web/agent3-file-upload-edit-form-report.json`

**Format**:
```json
{
  "agent": "Agent 3: File Upload Testing (Edit Form)",
  "testUrl": "https://test.ankaa.live",
  "timestamp": "2025-10-17T10:00:00.000Z",
  "summary": {
    "total": 5,
    "passed": 3,
    "failed": 1,
    "warnings": 1
  },
  "results": [
    {
      "testName": "Test Name",
      "status": "PASS|FAIL|WARN",
      "details": "Detailed execution log",
      "timestamp": "2025-10-17T10:00:00.000Z",
      "issues": ["List of issues found"]
    }
  ]
}
```

### Screenshots
**Location**: `/home/kennedy/repositories/web/test-results/`

Screenshots are automatically captured:
- Before each major action
- After file uploads
- After form submissions
- On errors

**Naming Convention**:
- `agent3-1-before-upload-*.png` - Test 1 before upload
- `agent3-1-after-upload-*.png` - Test 1 after upload
- `agent3-4-error-*.png` - Error screenshot from Test 4

### Videos
**Location**: `/home/kennedy/repositories/web/test-results/`

Full video recordings of each test execution are saved automatically.

## Common Issues and Solutions

### Issue 1: Submit Button Always Disabled
**Symptom**: Submit button never enables, even after changes

**Possible Causes**:
- Form validation not detecting file input changes
- Form dirty state not updated on file selection
- Required fields missing

**Debug Steps**:
1. Check browser console for validation errors
2. Inspect submit button's `disabled` attribute
3. Look for form validation logic in the code
4. Check if file inputs trigger form change events

### Issue 2: Files Not Persisting
**Symptom**: Files appear to upload but don't show up after save

**Possible Causes**:
- File upload endpoint failing silently
- File data not included in form submission
- Backend not processing file uploads

**Debug Steps**:
1. Check network tab for file upload requests
2. Verify FormData contains file data
3. Check backend logs for upload processing
4. Verify file storage configuration

### Issue 3: Existing Files Replaced
**Symptom**: Adding new files removes existing ones

**Possible Causes**:
- Frontend replaces file array instead of appending
- Backend overwrites instead of merging
- File field not handling multiple files correctly

**Debug Steps**:
1. Check if file input has `multiple` attribute
2. Inspect how new files are added to state
3. Verify backend merge logic
4. Check database update query

### Issue 4: File-Only Updates Don't Work
**Symptom**: Cannot submit form with only file changes (Test 4 fails)

**Possible Causes**:
- Form dirty state only tracks text inputs
- Change detection doesn't include file inputs
- Submit button enable logic incomplete

**Debug Steps**:
1. Add logging to form change handlers
2. Check if file inputs trigger onChange
3. Verify dirty state calculation
4. Review submit button enable conditions

## Debugging Tips

### Enable Verbose Logging
Modify the test file to add more console output:

```typescript
console.log('Current URL:', page.url());
console.log('Submit enabled:', await isSubmitButtonEnabled(page));
console.log('File count:', await getExistingFileCount(page, 'orcamentos'));
```

### Pause Test Execution
Add breakpoints in the test:

```typescript
await page.pause(); // Opens Playwright Inspector
```

### Check Element State
Inspect elements during test:

```typescript
const button = page.locator('button[type="submit"]');
console.log('Button disabled:', await button.getAttribute('disabled'));
console.log('Button aria-disabled:', await button.getAttribute('aria-disabled'));
console.log('Button classes:', await button.getAttribute('class'));
```

### Network Debugging
Monitor network requests:

```typescript
page.on('request', request => console.log('>>>', request.method(), request.url()));
page.on('response', response => console.log('<<<', response.status(), response.url()));
```

## Success Criteria

The test suite is considered PASSING when:

1. All 5 tests complete successfully
2. No CRITICAL issues in the report
3. File uploads work with and without text changes
4. Existing files are preserved when adding new ones
5. File deletion and replacement work correctly
6. Navigation properly clears unsaved files

## Critical Bugs to Report

If any of these occur, they should be reported as HIGH PRIORITY:

1. **Submit button disabled with file-only changes** (Test 4)
   - This prevents users from uploading files without text changes
   - Common form validation bug

2. **Existing files deleted when adding new ones** (Test 1)
   - Data loss issue
   - Backend or frontend merge logic bug

3. **Files not persisting after save** (All tests)
   - Upload functionality broken
   - Could be frontend or backend issue

4. **Cannot delete/replace files** (Test 2)
   - Missing functionality
   - Poor UX if files can only be added, never removed

## Next Steps

After running the tests:

1. Review the JSON report at `/home/kennedy/repositories/web/agent3-file-upload-edit-form-report.json`
2. Check screenshots in `/home/kennedy/repositories/web/test-results/`
3. Watch videos of failed tests to understand the issue
4. Fix any CRITICAL issues first
5. Address WARNINGS and minor issues
6. Re-run tests to verify fixes

## Contact

For questions or issues with this test suite, refer to the main test documentation or project README.
