#!/usr/bin/env python3

import csv
import json
import urllib.request
import urllib.parse
from datetime import datetime

# Configuration
CSV_FILE = "/Users/tommychavez/Downloads/contacts_61a81a63-57a2-4112-ab40-2024e58d5df3.csv"
SUPABASE_URL = "https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"
WORKSPACE_NAME = "David Amiri"
WORKSPACE_ID = 25
BISON_API_KEY = "77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BISON_BASE_URL = "https://send.maverickmarketingllc.com/api"

headers_supabase = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

headers_bison = {
    "Authorization": f"Bearer {BISON_API_KEY}",
    "Accept": "application/json"
}

print("=== Importing David Amiri Interested Leads from CSV ===\n")

# Fetch all leads from Email Bison to create email->ID mapping
print("Step 0: Fetching Email Bison lead IDs for URL mapping...")
email_to_id = {}
page = 1
while True:
    url = f"{BISON_BASE_URL}/leads?workspace_id={WORKSPACE_ID}&page={page}&per_page=100"
    req = urllib.request.Request(url)
    for key, value in headers_bison.items():
        req.add_header(key, value)

    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        leads = data.get('data', [])

        if not leads:
            break

        for lead in leads:
            if lead.get('email'):
                email_to_id[lead['email'].lower()] = lead['id']

        # Check if there are more pages
        meta = data.get('meta', {})
        if page >= meta.get('last_page', 1):
            break
        page += 1

        if page % 10 == 0:
            print(f"  Processed {page} pages, mapped {len(email_to_id)} emails...")

print(f"✓ Mapped {len(email_to_id)} email addresses to Bison lead IDs\n")

# Step 1: Delete existing David Amiri leads
print("Step 1: Deleting existing David Amiri leads...")
delete_url = f"{SUPABASE_URL}/rest/v1/client_leads?workspace_name=eq.David%20Amiri"
req = urllib.request.Request(delete_url, method='DELETE')
for key, value in headers_supabase.items():
    req.add_header(key, value)
urllib.request.urlopen(req)
print(f"✓ Deleted existing leads\n")

# Step 2: Read and parse CSV
print("Step 2: Reading CSV file...")
leads = []
with open(CSV_FILE, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for idx, row in enumerate(reader, start=1):
        email = row['Email'].lower() if row['Email'] else None
        lead_id = email_to_id.get(email) if email else None

        # Transform CSV row to database schema
        lead = {
            "bison_reply_id": f"csv_import_{idx}_{row['Email']}",
            "bison_lead_id": str(lead_id) if lead_id else f"csv_{idx}",
            "workspace_name": WORKSPACE_NAME,
            "lead_email": row['Email'],
            "first_name": row['First Name'] or None,
            "last_name": row['Last Name'] or None,
            "phone": row.get('phone number') or None,
            "address": row.get('address') or None,
            "city": row.get('city') or None,
            "state": row.get('state') or None,
            "zip": row.get('zip') or None,
            "title": row.get('Title') or None,
            "company": row.get('Company') or None,
            "custom_variables": [],
            "tags": [{"id": 264, "name": "Interested"}],
            "lead_status": None,
            "lead_campaign_data": [],
            "overall_stats": {
                "campaigns_count": int(row.get('Campaigns Count', 0) or 0),
                "emails_sent": int(row.get('Emails Sent', 0) or 0),
                "opens": int(row.get('Opens', 0) or 0),
                "replies": int(row.get('Replies', 0) or 0),
                "bounces": int(row.get('Bounces', 0) or 0)
            },
            "date_received": None,
            "reply_received": None,
            "email_subject": None,
            "lead_value": 500,
            "renewal_date": row.get('renewal date') or None,
            "birthday": row.get('date of birth') or None,
            "bison_conversation_url": f"https://send.maverickmarketingllc.com/leads/{lead_id}" if lead_id else None,
            "pipeline_stage": "new",
            "pipeline_position": 0,
        }
        leads.append(lead)

print(f"✓ Parsed {len(leads)} leads from CSV\n")

# Step 3: Insert leads in batches
print("Step 3: Inserting leads into Supabase...")
batch_size = 50
inserted_count = 0
error_count = 0

for i in range(0, len(leads), batch_size):
    batch = leads[i:i+batch_size]

    insert_url = f"{SUPABASE_URL}/rest/v1/client_leads"
    data = json.dumps(batch).encode('utf-8')
    req = urllib.request.Request(insert_url, data=data, method='POST')
    for key, value in headers_supabase.items():
        req.add_header(key, value)

    try:
        urllib.request.urlopen(req)
        inserted_count += len(batch)
        print(f"  ✓ Inserted batch {i//batch_size + 1}: {len(batch)} leads")
    except Exception as e:
        error_count += len(batch)
        print(f"  ✗ Error inserting batch {i//batch_size + 1}: {str(e)[:200]}")

print(f"\n=== Import Complete ===")
print(f"✓ Successfully inserted: {inserted_count} leads")
if error_count > 0:
    print(f"✗ Failed: {error_count} leads")

# Step 4: Verify count
print("\nVerifying...")
verify_url = f"{SUPABASE_URL}/rest/v1/client_leads?workspace_name=eq.David%20Amiri&select=id"
req = urllib.request.Request(verify_url)
req.add_header('apikey', SUPABASE_KEY)
req.add_header('Authorization', f'Bearer {SUPABASE_KEY}')
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode('utf-8'))
    count = len(data)
print(f"✓ Total leads in database: {count}\n")
print("All done! Check http://localhost:8082/client-portal/David%20Amiri")
