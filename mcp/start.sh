#!/bin/bash
# Get a fresh JWT token and start the MCP server
export CRM_API_URL="http://localhost:3333"
export CRM_TOKEN=$(curl -s -X POST http://localhost:3333/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"123456"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

node /Users/jpasv/www/crm-jp/mcp/dist/index.js
