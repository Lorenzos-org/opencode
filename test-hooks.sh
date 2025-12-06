#!/usr/bin/env sh

echo "=== Testing All Git Hooks ==="
echo

# Test pre-commit hook
echo "1. Testing pre-commit hook..."
if .husky/pre-commit; then
  echo "✓ Pre-commit hook passed"
else
  echo "✗ Pre-commit hook failed"
  exit 1
fi
echo

# Test pre-push hook  
echo "2. Testing pre-push hook..."
if .husky/pre-push; then
  echo "✓ Pre-push hook passed"
else
  echo "✗ Pre-push hook failed"
  exit 1
fi
echo

# Test checkpoint hook
echo "3. Testing checkpoint hook..."
if .husky/checkpoint; then
  echo "✓ Checkpoint hook passed"
else
  echo "✗ Checkpoint hook failed"
  exit 1
fi
echo

echo "=== All Hooks Test Results ==="
echo "✓ Pre-commit: Quality gates (typecheck + prettier)"
echo "✓ Pre-push: Version check + typecheck"  
echo "✓ Checkpoint: Lightweight development syntax check"
echo
echo "All hooks are working correctly!"