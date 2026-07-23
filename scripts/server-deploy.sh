#!/usr/bin/env bash
# Server-side deploy step, invoked over SSH by .github/workflows/deploy.yml
# after build artifacts have been rsynced into ~/heysous.
set -euo pipefail

cd ~/heysous

echo "Installing runtime dependencies..."
npm ci --omit=dev

echo "Restarting process..."
pm2 restart heysous --update-env

echo "Done. Recent logs:"
pm2 logs heysous --lines 10 --nostream
