#!/usr/bin/env tsx
/**
 * Automated migration script to fix menu positioning issues
 *
 * This script:
 * 1. Finds all files using the vulnerable positioning pattern
 * 2. Replaces useContextMenuPosition hook with PositionedDropdownMenuContent
 * 3. Removes manual positioning styles
 * 4. Creates a backup before making changes
 *
 * Usage: tsx scripts/fix-menu-positioning.ts [--dry-run] [--verbose]
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

interface FileChange {
  file: string;
  changes: string[];
  success: boolean;
  error?: string;
}

const results: FileChange[] = [];

// Patterns to find vulnerable files
const VULNERABLE_PATTERNS = [
  /calculatedPosition\?\.left\s*\?\?\s*contextMenu\?\.x/g,
  /calculatedPosition\?\.top\s*\?\?\s*contextMenu\?\.y/g,
];

function log(message: string, level: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    error: '\x1b[31m',   // Red
    warn: '\x1b[33m',    // Yellow
    reset: '\x1b[0m',
  };

  const prefix = {
    info: 'ℹ',
    success: '✓',
    error: '✗',
    warn: '⚠',
  };

  console.log(`${colors[level]}${prefix[level]} ${message}${colors.reset}`);
}

function isVulnerableFile(content: string): boolean {
  return VULNERABLE_PATTERNS.some(pattern => pattern.test(content));
}

function fixFileContent(content: string, filePath: string): { fixed: string; changes: string[] } {
  const changes: string[] = [];
  let fixed = content;

  // Step 1: Update imports
  if (fixed.includes('from "@/components/ui/dropdown-menu"')) {
    // Remove DropdownMenuContent from the import
    fixed = fixed.replace(
      /import\s*{\s*([^}]*DropdownMenuContent[^}]*)\s*}\s*from\s*"@\/components\/ui\/dropdown-menu"/,
      (match, imports) => {
        const importList = imports.split(',').map((i: string) => i.trim()).filter((i: string) => i !== 'DropdownMenuContent');
        changes.push('Removed DropdownMenuContent from dropdown-menu imports');
        return `import { ${importList.join(', ')} } from "@/components/ui/dropdown-menu"`;
      }
    );

    // Add PositionedDropdownMenuContent import if not present
    if (!fixed.includes('PositionedDropdownMenuContent')) {
      const dropdownImportIndex = fixed.indexOf('from "@/components/ui/dropdown-menu"');
      if (dropdownImportIndex !== -1) {
        const insertPosition = fixed.indexOf('\n', dropdownImportIndex) + 1;
        fixed = fixed.slice(0, insertPosition) +
          'import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";\n' +
          fixed.slice(insertPosition);
        changes.push('Added PositionedDropdownMenuContent import');
      }
    }
  }

  // Step 2: Remove useContextMenuPosition import
  if (fixed.includes('use-context-menu-position')) {
    fixed = fixed.replace(
      /import\s*{\s*useContextMenuPosition\s*}\s*from\s*["'][^"']*use-context-menu-position["'];?\n?/g,
      ''
    );
    changes.push('Removed useContextMenuPosition import');
  }

  // Step 3: Remove hook usage
  fixed = fixed.replace(
    /const\s*{\s*menuRef\s*,\s*calculatedPosition\s*}\s*=\s*useContextMenuPosition\([^)]*\);?\n?/g,
    ''
  );
  if (changes[changes.length - 1] !== 'Removed useContextMenuPosition hook usage') {
    changes.push('Removed useContextMenuPosition hook usage');
  }

  // Step 4: Replace DropdownMenuContent with PositionedDropdownMenuContent
  // Match the opening tag with all props
  fixed = fixed.replace(
    /<DropdownMenuContent\s+ref={menuRef}\s+style={{\s*position:\s*"fixed",\s*left:\s*`\$\{calculatedPosition\?\.left\s*\?\?\s*contextMenu\?\.x\s*\?\?\s*0\}px`,\s*top:\s*`\$\{calculatedPosition\?\.top\s*\?\?\s*contextMenu\?\.y\s*\?\?\s*0\}px`,\s*transform:\s*"none !important"\s+as\s+any,?\s*\}\}\s+className="([^"]*)(?:\s+!\[position:fixed\])?"\s+([^>]*)>/g,
    (match, className, otherProps) => {
      changes.push('Replaced DropdownMenuContent with PositionedDropdownMenuContent');
      return `<PositionedDropdownMenuContent\n        position={contextMenu}\n        isOpen={!!contextMenu}\n        className="${className}"\n        ${otherProps}>`;
    }
  );

  // Alternative pattern without some optional parts
  fixed = fixed.replace(
    /<DropdownMenuContent\s+ref={menuRef}\s+style={{[^}]*}}\s+className="([^"]*)"\s+([^>]*)>/g,
    (match, className, otherProps) => {
      if (match.includes('calculatedPosition')) {
        changes.push('Replaced DropdownMenuContent with PositionedDropdownMenuContent (alt pattern)');
        return `<PositionedDropdownMenuContent\n        position={contextMenu}\n        isOpen={!!contextMenu}\n        className="${className}"\n        ${otherProps}>`;
      }
      return match;
    }
  );

  // Step 5: Replace closing tag
  fixed = fixed.replace(
    /<\/DropdownMenuContent>/g,
    (match) => {
      // Only replace if we've already changed the opening tag
      if (changes.some(c => c.includes('PositionedDropdownMenuContent'))) {
        return '</PositionedDropdownMenuContent>';
      }
      return match;
    }
  );

  return { fixed, changes };
}

async function processFile(filePath: string): Promise<FileChange> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    if (!isVulnerableFile(content)) {
      if (VERBOSE) {
        log(`Skipping ${filePath} (not vulnerable)`, 'info');
      }
      return { file: filePath, changes: [], success: true };
    }

    if (VERBOSE) {
      log(`Processing ${filePath}...`, 'info');
    }

    const { fixed, changes } = fixFileContent(content, filePath);

    if (changes.length === 0) {
      log(`No changes needed for ${filePath}`, 'warn');
      return { file: filePath, changes: [], success: true };
    }

    if (!DRY_RUN) {
      // Create backup
      const backupPath = `${filePath}.bak`;
      fs.writeFileSync(backupPath, content);

      // Write fixed content
      fs.writeFileSync(filePath, fixed);
      log(`Fixed ${filePath} (${changes.length} changes)`, 'success');
    } else {
      log(`[DRY RUN] Would fix ${filePath} (${changes.length} changes)`, 'info');
    }

    return { file: filePath, changes, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error processing ${filePath}: ${errorMessage}`, 'error');
    return { file: filePath, changes: [], success: false, error: errorMessage };
  }
}

async function main() {
  log('Starting menu positioning fix migration...', 'info');

  if (DRY_RUN) {
    log('Running in DRY RUN mode - no files will be modified', 'warn');
  }

  // Find all TypeScript/TSX files in components directory
  const files = await glob('src/components/**/*.{ts,tsx}', { cwd: process.cwd() });

  log(`Found ${files.length} component files`, 'info');

  // Process each file
  for (const file of files) {
    const result = await processFile(file);
    if (result.changes.length > 0 || !result.success) {
      results.push(result);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  log('Migration Summary', 'info');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success && r.changes.length > 0);
  const failed = results.filter(r => !r.success);
  const skipped = files.length - results.length;

  log(`Total files scanned: ${files.length}`, 'info');
  log(`Files modified: ${successful.length}`, 'success');
  log(`Files failed: ${failed.length}`, failed.length > 0 ? 'error' : 'info');
  log(`Files skipped: ${skipped}`, 'info');

  if (successful.length > 0) {
    console.log('\nModified files:');
    successful.forEach(r => {
      console.log(`  • ${r.file}`);
      if (VERBOSE) {
        r.changes.forEach(c => console.log(`    - ${c}`));
      }
    });
  }

  if (failed.length > 0) {
    console.log('\nFailed files:');
    failed.forEach(r => {
      console.log(`  • ${r.file}: ${r.error}`);
    });
  }

  if (!DRY_RUN && successful.length > 0) {
    console.log('\n' + '⚠'.repeat(60));
    log('Backup files created with .bak extension', 'warn');
    log('Run: find src -name "*.bak" -delete to remove backups after verification', 'info');
  }

  console.log('='.repeat(60));
}

main().catch(error => {
  log(`Fatal error: ${error}`, 'error');
  process.exit(1);
});
