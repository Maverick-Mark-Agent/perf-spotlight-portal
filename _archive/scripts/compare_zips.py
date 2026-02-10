#!/usr/bin/env python3
import csv

# Read existing ZIP codes (from your 1300 list)
print("Reading existing ZIP codes...")
existing_zips = set()

with open('existing-texas-zips.csv', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        zip_code = row['ZipCode'].strip()
        if zip_code:  # Skip empty values
            existing_zips.add(zip_code)

print(f"Found {len(existing_zips)} unique ZIP codes in existing list")

# The new ZIP codes list will be read from the file you provided
# Since the file content was in your second attachment, I'll need to reference it
# For now, let me create a simple version that reads from a saved file

print("\nPlease save the second CSV file (zip-codes-database-FREE - Sheet1.csv)")
print("as 'new-texas-zips-full.csv' in this directory")

# Try to read if it exists
try:
    missing_zips = []

    with open('new-texas-zips-full.csv', 'r') as f:
        reader = csv.DictReader(f)
        header = reader.fieldnames

        for row in reader:
            zip_code = row['ZipCode'].strip()

            if zip_code and zip_code not in existing_zips:
                missing_zips.append(row)

    print(f"\nFound {len(missing_zips)} ZIP codes in new list that are missing from existing list")

    # Write missing ZIP codes to output file
    if missing_zips:
        with open('missing-texas-zips.csv', 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=header)
            writer.writeheader()
            writer.writerows(missing_zips)

        print(f"Created 'missing-texas-zips.csv' with {len(missing_zips)} missing ZIP codes")
        print("\nFirst 10 missing ZIP codes:")
        for i, row in enumerate(missing_zips[:10]):
            print(f"  {row['ZipCode']} - {row['City']}, {row['State']}")
    else:
        print("No missing ZIP codes found!")

except FileNotFoundError:
    print("File not found. Please save the new ZIP list as 'new-texas-zips-full.csv'")