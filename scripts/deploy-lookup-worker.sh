#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKER_DIR="$ROOT/workers/appliance-lookup"

cd "$WORKER_DIR"

if ! command -v wrangler >/dev/null 2>&1; then
  npm install
fi

echo "Deploying hk-appliance-lookup worker..."
echo "If this is your first deploy, run: npx wrangler secret put XAI_API_KEY"
npx wrangler deploy

echo ""
echo "Copy the workers.dev URL into the app under「查詢服務設定」."
echo "Never commit your xAI API key to git — use wrangler secret only."