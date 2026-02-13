#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Mobile contract summary" 
echo "- contracts: $ROOT/contracts"
echo "- ios docs: $ROOT/docs/sdd"
