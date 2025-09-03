#!/bin/bash

# Move to the script directory
cd "$(dirname "$0")"

# Load environment variables from .env file
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Run the TypeScript MCP server
node dist/index.js --transport stdio