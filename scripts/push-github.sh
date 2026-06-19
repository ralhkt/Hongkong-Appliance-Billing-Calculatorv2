#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Run: gh auth login"
  exit 1
fi

echo "Refreshing GitHub token with workflow scope (required for .github/workflows/ci.yml)..."
gh auth refresh -s workflow,repo -h github.com

echo "Pushing main to origin..."
git push origin main

echo "Checking latest CI run..."
gh run list --limit 1