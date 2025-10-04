#!/usr/bin/env python3
"""
Script to replace deep @ankaa/* imports (e.g., @ankaa/api-client/file) with local relative imports
"""

import os
import re
from pathlib import Path

# Base directory
WEB_DIR = Path("/home/kennedy/ankaa/separating/web")
SRC_DIR = WEB_DIR / "src"

# Package mappings
PACKAGES = ["constants", "types", "utils", "schemas", "api-client", "hooks"]

def get_relative_path(file_path: Path, target_package: str, sub_path: str = "") -> str:
    """
    Calculate the relative path from a file to a package directory or subdirectory.

    Args:
        file_path: The file that needs the import
        target_package: The package name (e.g., 'constants', 'types')
        sub_path: Optional sub-path within the package (e.g., 'file', 'backup')

    Returns:
        The relative import path (e.g., '../api-client/file', '../../types/user')
    """
    # Get the directory containing the file
    file_dir = file_path.parent

    # Target directory
    if sub_path:
        target_dir = SRC_DIR / target_package / sub_path
    else:
        target_dir = SRC_DIR / target_package

    # Calculate relative path
    try:
        rel_path = os.path.relpath(target_dir, file_dir)
        # Ensure we use forward slashes for imports
        rel_path = rel_path.replace("\\", "/")
        # Ensure it starts with ./ or ../
        if not rel_path.startswith(".."):
            rel_path = "./" + rel_path
        return rel_path
    except ValueError:
        # If paths are on different drives (Windows), return absolute
        return f"{target_package}/{sub_path}" if sub_path else target_package


def replace_deep_imports_in_file(file_path: Path) -> tuple[bool, int]:
    """
    Replace all deep @ankaa/* imports in a file with local relative imports.
    Handles patterns like: @ankaa/api-client/file, @ankaa/hooks/queryKeys, etc.

    Returns:
        (modified, count) - whether file was modified and number of replacements
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return False, 0

    original_content = content
    total_replacements = 0

    for package in PACKAGES:
        # Pattern to match deep imports from @ankaa/package/subpath
        # Matches: import ... from "@ankaa/package/subpath"
        #          import ... from '@ankaa/package/subpath'
        # Also handles: import("@ankaa/package/subpath")

        # Updated pattern to capture the sub-path
        pattern = rf'''(from\s+['"]|import\s*\(\s*['"])@ankaa/{re.escape(package)}(/[^'"]+)?(['"])'''

        # Find all matches
        matches = list(re.finditer(pattern, content))
        if not matches:
            continue

        # Process each match
        for match in matches:
            prefix = match.group(1)  # 'from "' or 'import("'
            sub_path = match.group(2)  # e.g., '/file' or None
            suffix = match.group(3)  # '"' or "'"

            # Clean up sub_path
            if sub_path:
                sub_path = sub_path.lstrip('/')
            else:
                sub_path = ""

            # Calculate the relative path
            if sub_path:
                # Deep import - need to point to specific file/directory
                rel_path = get_relative_path(file_path, package, sub_path)
            else:
                # Package-level import
                rel_path = get_relative_path(file_path, package)

            # Replace this specific occurrence
            old_text = match.group(0)
            new_text = f'{prefix}{rel_path}{suffix}'

            content = content.replace(old_text, new_text, 1)
            total_replacements += 1

    # Write back if modified
    if content != original_content:
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True, total_replacements
        except Exception as e:
            print(f"Error writing {file_path}: {e}")
            return False, 0

    return False, 0


def process_directory(directory: Path) -> dict:
    """
    Process all TypeScript/JavaScript files in a directory recursively.

    Returns:
        Statistics about the operation
    """
    stats = {
        'files_processed': 0,
        'files_modified': 0,
        'total_replacements': 0,
        'errors': []
    }

    # Find all .ts and .tsx files
    for file_path in directory.rglob("*.ts*"):
        # Skip node_modules and other non-source directories
        if "node_modules" in file_path.parts or ".git" in file_path.parts:
            continue

        # Skip if not a file
        if not file_path.is_file():
            continue

        stats['files_processed'] += 1

        modified, count = replace_deep_imports_in_file(file_path)

        if modified:
            stats['files_modified'] += 1
            stats['total_replacements'] += count
            # Show relative path from web directory
            rel_file = file_path.relative_to(WEB_DIR)
            print(f"✓ {rel_file}: {count} deep imports replaced")

    return stats


def main():
    print("=" * 80)
    print("Replacing deep @ankaa/* imports with local relative imports")
    print("=" * 80)
    print(f"Working directory: {WEB_DIR}")
    print(f"Source directory: {SRC_DIR}")
    print(f"Packages to replace: {', '.join(PACKAGES)}")
    print("=" * 80)
    print()

    # Verify directories exist
    if not SRC_DIR.exists():
        print(f"Error: Source directory not found: {SRC_DIR}")
        return

    print("Processing files...")
    print()

    # Process the src directory
    stats = process_directory(SRC_DIR)

    # Print summary
    print()
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Files processed:     {stats['files_processed']}")
    print(f"Files modified:      {stats['files_modified']}")
    print(f"Total replacements:  {stats['total_replacements']}")

    if stats['errors']:
        print(f"\nErrors encountered:  {len(stats['errors'])}")
        for error in stats['errors'][:10]:  # Show first 10 errors
            print(f"  - {error}")

    print("=" * 80)
    print("Done!")


if __name__ == "__main__":
    main()
