#!/usr/bin/env python3
"""
Script to replace @ankaa/* imports with local relative imports
"""

import os
import re
from pathlib import Path

# Base directory
WEB_DIR = Path("/home/kennedy/ankaa/separating/web")
SRC_DIR = WEB_DIR / "src"

# Package mappings
PACKAGES = ["constants", "types", "utils", "schemas", "api-client", "hooks"]

def get_relative_path(file_path: Path, target_package: str) -> str:
    """
    Calculate the relative path from a file to a package directory.

    Args:
        file_path: The file that needs the import
        target_package: The package name (e.g., 'constants', 'types')

    Returns:
        The relative import path (e.g., '../constants', '../../types')
    """
    # Get the directory containing the file
    file_dir = file_path.parent

    # Target directory
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
        return target_package


def replace_imports_in_file(file_path: Path) -> tuple[bool, int]:
    """
    Replace all @ankaa/* imports in a file with local relative imports.

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
        # Pattern to match imports from @ankaa/package
        # Matches: import ... from "@ankaa/package"
        #          import ... from '@ankaa/package'
        pattern = rf'''(from\s+['"])@ankaa/{re.escape(package)}(['"])'''

        # Count matches first
        matches = re.findall(pattern, content)
        if not matches:
            continue

        # Calculate the relative path for this file
        rel_path = get_relative_path(file_path, package)

        # Replace all occurrences
        replacement = rf'\1{rel_path}\2'
        new_content = re.sub(pattern, replacement, content)

        replacements = len(matches)
        if replacements > 0:
            total_replacements += replacements
            content = new_content

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

        modified, count = replace_imports_in_file(file_path)

        if modified:
            stats['files_modified'] += 1
            stats['total_replacements'] += count
            # Show relative path from web directory
            rel_file = file_path.relative_to(WEB_DIR)
            print(f"✓ {rel_file}: {count} imports replaced")

    return stats


def main():
    print("=" * 80)
    print("Replacing @ankaa/* imports with local relative imports")
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

    for package in PACKAGES:
        pkg_dir = SRC_DIR / package
        if not pkg_dir.exists():
            print(f"Warning: Package directory not found: {pkg_dir}")

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
