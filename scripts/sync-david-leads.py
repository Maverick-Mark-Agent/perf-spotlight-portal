#!/usr/bin/env python3

import requests
import json

# Configuration
BISON_API_KEY = "77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BISON_BASE_URL = "https://send.maverickmarketingllc.com/api"
SUPABASE_URL = "https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"
WORKSPACE_ID = 25
WORKSPACE_NAME = "David Amiri"
INTERESTED_TAG_ID = 190

headers_bison = {
    "Authorization": f"Bearer {BISON_API_KEY}",
    "Accept": "application/json"
}

headers_supabase = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

print("=== Syncing David Amiri Interested Leads ===\n")

# Step 1: Delete existing David Amiri leads
print("Step 1: Deleting existing David Amiri leads...")
delete_url = f"{SUPABASE_URL}/rest/v1/client_leads?workspace_name=eq.David%20Amiri"
response = requests.delete(delete_url, headers=headers_supabase)
print(f"✓ Deleted existing leads (status: {response.status_code})\n")

# Step 2: Fetch interested leads from Email Bison
print("Step 2: Fetching interested leads from Email Bison...")

# Build params for tag filter
params = {
    "workspace_id": WORKSPACE_ID,
    "filters[tag_ids][]": INTERESTED_TAG_ID,
    "page": 1,
    "per_page": 1
}

# Get total count first
response = requests.get(f"{BISON_BASE_URL}/leads", headers=headers_bison, params=params)
if response.status_code != 200:
    print(f"Error fetching leads: {response.status_code}")
    print(response.text)
    exit(1)

data = response.json()
total = data.get("meta", {}).get("total", 0)
print(f"Found {total} interested leads\n")

# Calculate pages
per_page = 100
pages = (total + per_page - 1) // per_page
print(f"Fetching {pages} pages...\n")

# Step 3: Fetch and insert leads page by page
all_leads = []
for page in range(1, pages + 1):
    print(f"Processing page {page}/{pages}...")

    params["page"] = page
    params["per_page"] = per_page

    response = requests.get(f"{BISON_BASE_URL}/leads", headers=headers_bison, params=params)
    if response.status_code != 200:
        print(f"Error on page {page}: {response.status_code}")
        continue

    page_data = response.json()
    leads = page_data.get("data", [])

    # Transform and collect leads
    for lead in leads:
        transformed = {
            "bison_reply_id": f"lead_{lead['id']}",
            "bison_lead_id": str(lead['id']),
            "workspace_name": WORKSPACE_NAME,
            "lead_email": lead.get('email'),
            "first_name": lead.get('first_name'),
            "last_name": lead.get('last_name'),
            "phone": lead.get('phone'),
            "address": lead.get('address'),
            "city": lead.get('city'),
            "state": lead.get('state'),
            "zip": lead.get('zip'),
            "title": lead.get('title'),
            "company": lead.get('company'),
            "custom_variables": lead.get('custom_variables', []),
            "tags": lead.get('tags', []),
            "lead_status": lead.get('status'),
            "lead_campaign_data": lead.get('lead_campaign_data', []),
            "overall_stats": lead.get('overall_stats'),
            "date_received": None,
            "reply_received": None,
            "email_subject": None,
            "lead_value": 500,
            "renewal_date": None,
            "birthday": None,
            "bison_conversation_url": f"https://send.maverickmarketingllc.com/leads/{lead['id']}",
            "pipeline_stage": "new",
            "pipeline_position": 0,
        }
        all_leads.append(transformed)

    print(f"✓ Collected {len(leads)} leads from page {page} (total: {len(all_leads)})")

print(f"\n=== Inserting {len(all_leads)} Leads into Supabase ===\n")

# Insert in batches of 50
batch_size = 50
for i in range(0, len(all_leads), batch_size):
    batch = all_leads[i:i+batch_size]

    insert_url = f"{SUPABASE_URL}/rest/v1/client_leads"
    response = requests.post(insert_url, headers=headers_supabase, json=batch)

    if response.status_code in [200, 201]:
        print(f"✓ Inserted batch {i//batch_size + 1}: {len(batch)} leads")
    else:
        print(f"✗ Error inserting batch {i//batch_size + 1}: {response.status_code}")
        print(response.text[:200])

print("\n=== Sync Complete ===\n")

# Step 4: Verify count
print("Verifying...")
verify_url = f"{SUPABASE_URL}/rest/v1/client_leads?workspace_name=eq.David%20Amiri&select=id"
response = requests.get(verify_url, headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"})
count = len(response.json())
print(f"✓ Total leads in database: {count}\n")
print("All done! Check http://localhost:8082/client-portal/David%20Amiri")
