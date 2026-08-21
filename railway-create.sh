#!/bin/bash

# Railway API endpoint
BASE_URL="https://api.railway.app/graphql"
API_KEY="b69de1fa-16b2-4fd0-928d-acdf52513d9d"

# Create project mutation
MUTATION='
mutation {
  projectCreate(input: {name: "PULSE - WhatsApp Orders"}) {
    project {
      id
      name
      createdAt
    }
  }
}
'

curl -X POST "$BASE_URL" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$(echo $MUTATION | sed 's/"/\\"/g' | tr '\n' ' ')\"}"
