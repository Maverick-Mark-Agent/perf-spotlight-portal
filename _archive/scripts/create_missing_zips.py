#!/usr/bin/env python3
import csv
from io import StringIO

# Existing ZIP codes from first document
existing_data = """ZipCode,Client,Labeled Color
75135,David Amiri,Blue
75149,David Amiri,Blue
75401,David Amiri,Blue"""  # This is just a sample - the full list is in existing-texas-zips.csv

# Read existing ZIPs from the file we created
print("Reading existing ZIP codes from your 1300 list...")
existing_zips = set()

with open('existing-texas-zips.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        zip_code = row['ZipCode'].strip()
        if zip_code:
            existing_zips.add(zip_code)

print(f"Loaded {len(existing_zips)} unique ZIP codes from existing list")

# Now I need to read the new ZIP codes
# Since the document was attached, I'll read it from the standard CSV structure
# The file should be named as provided in the attachment

print("\nLooking for the new ZIP codes file...")
print("Searching for: 'zip-codes-database-FREE - Sheet1.csv'")

# Try different possible filenames
possible_names = [
    'zip-codes-database-FREE - Sheet1.csv',
    'zip-codes-database-FREE-Sheet1.csv',
    'new-texas-zips-full.csv'
]

new_file_found = None
for filename in possible_names:
    try:
        with open(filename, 'r') as f:
            new_file_found = filename
            break
    except FileNotFoundError:
        continue

if not new_file_found:
    print("\nCould not find the new ZIP codes file.")
    print("Please save your second CSV file as 'new-texas-zips-full.csv'")
    print("Then run this script again.")
    exit(1)

print(f"Found new ZIP list: {new_file_found}")
print("Comparing ZIP codes...")

missing_zips = []

with open(new_file_found, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    header = reader.fieldnames

    for row in reader:
        zip_code = row['ZipCode'].strip()

        if zip_code and zip_code not in existing_zips:
            missing_zips.append(row)

print(f"\nFound {len(missing_zips)} ZIP codes in the new list that are NOT in your existing 1300 list")

# Write to output file
if missing_zips:
    output_file = 'missing-texas-zips.csv'
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=header)
        writer.writeheader()
        writer.writerows(missing_zips)

    print(f"\n✓ Created '{output_file}' with {len(missing_zips)} missing ZIP codes")
    print("\nFirst 20 missing ZIP codes:")
    print("-" * 60)
    for i, row in enumerate(missing_zips[:20], 1):
        print(f"{i:2}. {row['ZipCode']:5} - {row['City']}, {row['State']} (Pop: {row['Population']})")
    print("-" * 60)
    print(f"\nTotal missing: {len(missing_zips)} ZIP codes")
    print(f"Output saved to: {output_file}")
else:
    print("\n No missing ZIP codes found - all ZIPs in the new list are already in your existing list!")