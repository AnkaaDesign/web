# Quick Start: Agent 3 File Upload Tests

## Run All Tests

```bash
cd /home/kennedy/repositories/web
BASE_URL=https://test.ankaa.live npx playwright test agent3-file-upload-edit-form.spec.ts
```

## Run with Browser Visible (Recommended First Time)

```bash
cd /home/kennedy/repositories/web
HEADLESS=false BASE_URL=https://test.ankaa.live npx playwright test agent3-file-upload-edit-form.spec.ts
```

## Run Specific Test

```bash
# Test 1: Adding Files
npx playwright test agent3-file-upload-edit-form.spec.ts -g "Adding Files"

# Test 2: Replacing Files
npx playwright test agent3-file-upload-edit-form.spec.ts -g "Replacing Files"

# Test 3: Mixed Updates
npx playwright test agent3-file-upload-edit-form.spec.ts -g "Mixed Updates"

# Test 4: File-Only Updates (CRITICAL)
npx playwright test agent3-file-upload-edit-form.spec.ts -g "File-Only Updates"

# Test 5: Navigation Test
npx playwright test agent3-file-upload-edit-form.spec.ts -g "Navigation Test"
```

## View Results

### JSON Report
```bash
cat /home/kennedy/repositories/web/agent3-file-upload-edit-form-report.json | jq
```

### HTML Report
```bash
npx playwright show-report
```

### Screenshots
```bash
ls -lh /home/kennedy/repositories/web/test-results/agent3-*.png
```

## Key Files

- **Test File**: `/home/kennedy/repositories/web/tests/agent3-file-upload-edit-form.spec.ts`
- **Report**: `/home/kennedy/repositories/web/agent3-file-upload-edit-form-report.json`
- **Documentation**: `/home/kennedy/repositories/web/AGENT3-FILE-UPLOAD-EDIT-FORM-README.md`
- **Screenshots**: `/home/kennedy/repositories/web/test-results/`

## What Gets Tested

1. Adding new files to existing tasks
2. Replacing/deleting files
3. Mixed updates (text + files)
4. **File-only updates (CRITICAL)** - Can you upload files without changing text?
5. Navigation behavior with unsaved files

## Critical Bug to Watch For

**Test 4 (File-Only Updates)** checks if the submit button is enabled when ONLY files are changed.

If this fails, it means users CANNOT upload files without also changing text fields - a serious UX bug.

## Credentials

- URL: https://test.ankaa.live
- Email: kennedy.ankaa@gmail.com
- Password: abc123456

## Need Help?

See the full documentation: `/home/kennedy/repositories/web/AGENT3-FILE-UPLOAD-EDIT-FORM-README.md`
