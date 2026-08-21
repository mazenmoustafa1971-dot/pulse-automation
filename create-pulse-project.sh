#!/bin/bash

# Railway GraphQL mutation to create project
QUERY='
mutation CreateProject($input: ProjectCreateInput!) {
  projectCreate(input: $input) {
    project {
      id
      name
      createdAt
    }
  }
}
'

VARIABLES='{
  "input": {
    "name": "PULSE - WhatsApp Orders"
  }
}'

echo "Creating PULSE project on Railway..."
echo ""

curl -s -X POST https://railway.com/api/graphql \
  -H "Authorization: Bearer b69de1fa-16b2-4fd0-928d-acdf52513d9d" \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": $(echo "$QUERY" | jq -R -s .),
    \"variables\": $VARIABLES
  }" > response.json

echo "Response:"
cat response.json | jq '.' 2>/dev/null || cat response.json

# Extract project ID if successful
PROJECT_ID=$(cat response.json | jq -r '.data.projectCreate.project.id' 2>/dev/null)
if [ ! -z "$PROJECT_ID" ] && [ "$PROJECT_ID" != "null" ]; then
  echo ""
  echo "✅ SUCCESS!"
  echo "Project ID: $PROJECT_ID"
  echo "Project Name: PULSE - WhatsApp Orders"
  echo ""
  echo "Dashboard: https://railway.app/project/$PROJECT_ID"
else
  echo ""
  echo "❌ Failed to create project"
  cat response.json | jq '.errors' 2>/dev/null || echo "Check response.json for details"
fi
