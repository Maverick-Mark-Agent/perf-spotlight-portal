#!/bin/bash

# Get found emails
found=$(jq -r '.[].email_address' email-accounts-result.json | sort)

# Get requested emails
requested=$(tail -n +2 "Email Campaign Health Report - Sheet5.csv" | cut -d',' -f1 | tr -d '"' | grep '@' | sort)

# Find missing
echo "⚠️  The following 19 emails were NOT FOUND in the database:"
echo ""
comm -13 <(echo "$found") <(echo "$requested")
