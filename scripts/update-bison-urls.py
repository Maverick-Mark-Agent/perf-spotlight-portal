#!/usr/bin/env python3

import json
import urllib.request
import urllib.parse
import time

# Configuration
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
}

headers_bison = {
    "Authorization": f"Bearer {BISON_API_KEY}",
    "Accept": "application/json"
}

print("=== Updating Bison Conversation URLs for David Amiri Leads ===\n")

# Step 1: Get all David Amiri leads from database that don't have URLs
print("Step 1: Fetching leads without URLs from database...")
url = f"{SUPABASE_URL}/rest/v1/client_leads?workspace_name=eq.{urllib.parse.quote(WORKSPACE_NAME)}&select=id,lead_email"
req = urllib.request.Request(url)
for key, value in headers_supabase.items():
    req.add_header(key, value)

with urllib.request.urlopen(req) as response:
    db_leads = json.loads(response.read().decode('utf-8'))

print(f"✓ Found {len(db_leads)} leads in database\n")

# Step 2: Fetch Email Bison leads and build complete mapping
print("Step 2: Fetching Bison lead IDs...")
email_to_bison_id = {}
page = 1
max_pages = 500  # ~7,500 leads at 15 per page

while page <= max_pages:
    url = f"{BISON_BASE_URL}/leads?workspace_id={WORKSPACE_ID}&page={page}&per_page=100"
    req = urllib.request.Request(url)
    for key, value in headers_bison.items():
        req.add_header(key, value)

    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            leads = data.get('data', [])

            if not leads:
                break

            # Build email to ID mapping
            for lead in leads:
                if lead.get('email'):
                    email_to_bison_id[lead['email'].lower()] = lead['id']

            if page % 100 == 0:
                print(f"  Processed {page} pages, mapped {len(email_to_bison_id)} emails...")

            # Check how many of our database leads we've found
            found_count = sum(1 for db_lead in db_leads
                            if db_lead.get('lead_email') and
                            db_lead['lead_email'].lower() in email_to_bison_id)

            # If we've found all leads, exit early
            if found_count >= len(db_leads):
                print(f"  Found all {found_count} database leads at page {page}")
                break

            # Check if there are more pages
            meta = data.get('meta', {})
            if page >= meta.get('last_page', 1):
                break

            page += 1
            time.sleep(0.05)  # Small delay to avoid rate limiting

    except Exception as e:
        print(f"  Error on page {page}: {str(e)[:100]}")
        break

print(f"✓ Mapped {len(email_to_bison_id)} total emails from Bison\n")

# Step 3: Update all database leads with URLs
print("Step 3: Updating database with Bison URLs...")
updated_count = 0
not_found_count = 0

for db_lead in db_leads:
    email = db_lead['lead_email'].lower() if db_lead.get('lead_email') else None

    if email and email in email_to_bison_id:
        bison_id = email_to_bison_id[email]
        bison_url = f"https://send.maverickmarketingllc.com/leads/{bison_id}"

        # Update this lead
        update_url = f"{SUPABASE_URL}/rest/v1/client_leads?id=eq.{db_lead['id']}"
        update_data = json.dumps({
            "bison_conversation_url": bison_url,
            "bison_lead_id": str(bison_id)
        }).encode('utf-8')
        req = urllib.request.Request(update_url, data=update_data, method='PATCH')
        for key, value in headers_supabase.items():
            req.add_header(key, value)

        try:
            urllib.request.urlopen(req)
            updated_count += 1
            if updated_count % 50 == 0:
                print(f"  Updated {updated_count}/{len(db_leads)} leads...")
        except Exception as e:
            print(f"  Error updating lead {email}: {str(e)[:100]}")
    else:
        not_found_count += 1
        if not_found_count <= 5:
            print(f"  Lead not found in Bison: {email}")

if not_found_count > 5:
    print(f"  ... and {not_found_count - 5} more not found")

print(f"\n=== Update Complete ===")
print(f"✓ Updated {updated_count} out of {len(db_leads)} leads with Bison URLs")

# Verify
print("\nVerifying...")
verify_url = f"{SUPABASE_URL}/rest/v1/client_leads?workspace_name=eq.{urllib.parse.quote(WORKSPACE_NAME)}&select=bison_conversation_url&bison_conversation_url=not.is.null"
req = urllib.request.Request(verify_url)
req.add_header('apikey', SUPABASE_KEY)
req.add_header('Authorization', f'Bearer {SUPABASE_KEY}')
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode('utf-8'))
    count_with_urls = len(data)

print(f"✓ {count_with_urls} leads now have Bison conversation URLs\n")
