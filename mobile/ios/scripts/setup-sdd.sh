#!/usr/bin/env bash
set -euo pipefail

if ! command -v sdd > /dev/null 2>&1; then
  echo "sdd-tool is not installed. Run: npm install -g sdd-tool"
  exit 1
fi

sdd --version
cd "$(dirname "$0")/.."
sdd init --skip-git-setup --auto-approve
sdd validate --strict
