# Agent 3: File Upload Testing - Execution Guide

## Pre-Flight Checklist

Before running tests, ensure:

- [ ] Network access to https://test.ankaa.live (VPN if needed)
- [ ] Test credentials work (kennedy.ankaa@gmail.com / abc123456)
- [ ] At least one task exists in /producao/cronograma
- [ ] Playwright installed (`npm install` in /home/kennedy/repositories/web)

## Test Execution Steps

### Step 1: Initial Run (Recommended with Browser Visible)

```bash
cd /home/kennedy/repositories/web
HEADLESS=false BASE_URL=https://test.ankaa.live \
  npx playwright test agent3-file-upload-edit-form.spec.ts
```

**What to watch for:**
- Login succeeds
- Navigation to task list works
- Task edit form opens
- File inputs are visible
- Submit button state changes

### Step 2: Review Results

After tests complete:

```bash
# View JSON report
cat agent3-file-upload-edit-form-report.json | jq '.summary'

# Check for CRITICAL issues
cat agent3-file-upload-edit-form-report.json | jq '.results[] | select(.status == "FAIL")'

# List screenshots
ls -lh test-results/agent3-*.png
```

### Step 3: Focus on Critical Test (Test 4)

If other tests are passing but you want to validate the critical issue:

```bash
npx playwright test agent3-file-upload-edit-form.spec.ts -g "File-Only"
```

**Expected outcome:**
- Opens a task
- Adds ONLY a file (no text changes)
- Submit button should be ENABLED
- File should save successfully

**If this fails:**
- Submit button stays disabled
- This is the #1 critical bug to fix
- See "Issue 1" in debugging section below

### Step 4: Debug Failed Tests

For each failed test:

1. **Check screenshot before/after**
   ```bash
   ls test-results/agent3-1-*.png  # Test 1 screenshots
   ls test-results/agent3-4-*.png  # Test 4 screenshots
   ```

2. **Watch the video**
   ```bash
   # Open in default video player
   xdg-open test-results/*.webm
   ```

3. **Review detailed logs**
   ```bash
   cat agent3-file-upload-edit-form-report.json | jq '.results[0]'
   ```

## Understanding Test Results

### PASS Example

```json
{
  "testName": "Adding Files to Existing Task",
  "status": "PASS",
  "details": "Editing task ID: 123\nFiles added: Budget, Invoice, Receipt, Artwork\nSubmit button enabled after upload: true\nForm submitted successfully",
  "timestamp": "2025-10-17T10:00:00.000Z"
}
```

**Interpretation:** Test succeeded, no issues

### FAIL Example

```json
{
  "testName": "File-Only Updates",
  "status": "FAIL",
  "details": "Editing task ID: 123\nAdded artwork file (NO text changes made)\nSubmit button enabled AFTER file-only upload: false",
  "issues": [
    "CRITICAL BUG: Submit button is DISABLED when ONLY files are changed (no text changes)",
    "This prevents users from uploading files to existing tasks without modifying text fields"
  ],
  "timestamp": "2025-10-17T10:00:00.000Z"
}
```

**Interpretation:** Critical bug found - users can't upload files without text changes

### WARN Example

```json
{
  "testName": "Replacing Files",
  "status": "WARN",
  "details": "Editing task ID: 123\nNo delete buttons found, cannot test file removal",
  "issues": [
    "Delete button for existing files not found"
  ],
  "timestamp": "2025-10-17T10:00:00.000Z"
}
```

**Interpretation:** Test ran but found non-critical issue

## Common Issues and Quick Fixes

### Issue 1: Submit Button Disabled (File-Only Updates)

**Symptom:**
```
Test 4 FAILS
"Submit button is DISABLED when ONLY files are changed"
```

**Quick Check:**
1. Open a task manually in browser
2. Add a file without changing text
3. See if submit button becomes enabled

**Fix Location:**
- Look for form validation logic
- Check dirty state calculation
- Ensure file inputs trigger form changes

**Example Fix:**
```typescript
// In your form component
const [hasFileChanges, setHasFileChanges] = useState(false);

// Add to file input handlers
const handleFileChange = () => {
  setHasFileChanges(true);
};

// Update submit button enable logic
const canSubmit = isDirty || hasFileChanges;
```

### Issue 2: Files Don't Save

**Symptom:**
```
Multiple tests FAIL
"File count after save: 0" (should be > 0)
```

**Quick Check:**
1. Open DevTools Network tab
2. Submit form with file
3. Check request payload for file data
4. Check response for errors

**Fix Locations:**
- Frontend: FormData construction
- Backend: File upload endpoint
- Storage: File system/S3 permissions

### Issue 3: Existing Files Replaced

**Symptom:**
```
Test 1 FAILS
"Budget file count DECREASED after save"
```

**Quick Check:**
1. Add files to a task
2. Edit task and add more files
3. Save and check if old files still exist

**Fix Locations:**
- Frontend: File array merge logic
- Backend: Update query (append vs replace)

### Issue 4: Selectors Don't Match

**Symptom:**
```
Multiple tests WARN
"Budget file input not found"
```

**Quick Check:**
1. Inspect file input in browser DevTools
2. Check actual `name` attribute
3. Update selectors in test file

**Fix Location:**
```typescript
// In agent3-file-upload-edit-form.spec.ts
const FILE_SELECTORS = {
  orcamento: 'input[name="orcamentos"]',  // Update this
  // ... etc
};
```

## Test Priority Order

Fix issues in this order:

1. **Test 4 - File-Only Updates** (CRITICAL)
   - Worst UX impact
   - Blocks basic file upload functionality
   - Most common bug

2. **Test 1 - Adding Files** (HIGH)
   - Prevents data loss
   - Core feature

3. **Test 3 - Mixed Updates** (HIGH)
   - Common usage pattern
   - Both types of changes needed

4. **Test 2 - Replacing Files** (MEDIUM)
   - Important but workarounds exist

5. **Test 5 - Navigation** (LOW)
   - UX polish
   - No functional impact

## Re-Running After Fixes

After fixing issues:

```bash
# Run all tests
npx playwright test agent3-file-upload-edit-form.spec.ts

# Or run specific fixed test
npx playwright test agent3-file-upload-edit-form.spec.ts -g "File-Only"

# Compare results
cat agent3-file-upload-edit-form-report.json | jq '.summary'
```

**Success Criteria:**
```json
{
  "total": 5,
  "passed": 5,
  "failed": 0,
  "warnings": 0
}
```

## Advanced Debugging

### Enable Playwright Inspector

```bash
PWDEBUG=1 npx playwright test agent3-file-upload-edit-form.spec.ts -g "File-Only"
```

This opens an inspector where you can:
- Step through test actions
- Inspect page state
- Try selectors
- View console logs

### Generate New Selectors

If file inputs have changed:

```bash
npx playwright codegen https://test.ankaa.live
```

This opens a browser where you can:
- Click on elements
- Copy generated selectors
- Update test file

### Add Custom Logging

Edit test file to add more detail:

```typescript
// In agent3-file-upload-edit-form.spec.ts
// Add before critical actions:

console.log('Form state:', await page.evaluate(() => {
  return {
    url: window.location.href,
    submitEnabled: !document.querySelector('button[type="submit"]')?.disabled,
    fileInputs: Array.from(document.querySelectorAll('input[type="file"]')).length
  };
}));
```

## Getting Help

If tests continue to fail:

1. **Review full documentation**
   - /home/kennedy/repositories/web/AGENT3-FILE-UPLOAD-EDIT-FORM-README.md

2. **Check test implementation**
   - /home/kennedy/repositories/web/tests/agent3-file-upload-edit-form.spec.ts

3. **Review screenshots and videos**
   - /home/kennedy/repositories/web/test-results/

4. **Validate manually**
   - Try the same steps manually in browser
   - Compare behavior with test expectations

## Quick Reference Commands

```bash
# Run all tests
cd /home/kennedy/repositories/web && BASE_URL=https://test.ankaa.live \
  npx playwright test agent3-file-upload-edit-form.spec.ts

# Run with browser visible
HEADLESS=false BASE_URL=https://test.ankaa.live \
  npx playwright test agent3-file-upload-edit-form.spec.ts

# Run critical test only
npx playwright test agent3-file-upload-edit-form.spec.ts -g "File-Only"

# View results
cat agent3-file-upload-edit-form-report.json | jq

# View HTML report
npx playwright show-report

# List screenshots
ls -lh test-results/agent3-*.png

# Debug mode
PWDEBUG=1 npx playwright test agent3-file-upload-edit-form.spec.ts
```

## Expected Timeline

- **Initial Run**: 2-5 minutes (all 5 tests)
- **Single Test**: 30-60 seconds
- **Fix & Retest**: 5-10 minutes per issue
- **Full Validation**: 10-15 minutes

## Success Indicators

When all tests pass, you should see:

```
✅ Adding Files to Existing Task (PASS)
✅ Replacing Files (PASS)
✅ Mixed Updates (Text + Files) (PASS)
✅ File-Only Updates (PASS) ⭐ CRITICAL
✅ Navigation Test with Files (PASS)

Summary: 5 passed, 0 failed, 0 warnings
```

## Final Checklist

After successful test run:

- [ ] All 5 tests show PASS status
- [ ] No CRITICAL issues in report
- [ ] Test 4 specifically passes
- [ ] Manual verification confirms behavior
- [ ] Screenshots show expected UI state
- [ ] No console errors in videos

## Next Steps

Once tests pass:
1. Run tests regularly (CI/CD integration recommended)
2. Update tests when form fields change
3. Add new tests for new file upload features
4. Keep documentation current

---

**For More Information:**
- Full docs: /home/kennedy/repositories/web/AGENT3-FILE-UPLOAD-EDIT-FORM-README.md
- Quick start: /home/kennedy/repositories/web/RUN-AGENT3-TESTS.md
- Complete guide: /home/kennedy/repositories/web/tests/README-AGENT3.md
