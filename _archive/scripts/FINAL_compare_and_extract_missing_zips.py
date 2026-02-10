#!/usr/bin/env python3
"""
This script compares two ZIP code lists and extracts missing ones.
It will create 'missing-texas-zips.csv' with ZIPs in the new list but not in the existing list.
"""

import csv
import os

def main():
    print("="*70)
    print("TEXAS ZIP CODES COMPARISON TOOL")
    print("="*70)

    # Check if files exist
    existing_file = 'existing-texas-zips.csv'

    # Try to find the new ZIP codes file
    possible_new_files = [
        'zip-codes-database-FREE - Sheet1.csv',
        'new-texas-zips-full.csv',
        'Zip-Code-Master-List-PROCESSED-November.csv'
    ]

    new_file = None
    for filename in possible_new_files:
        if os.path.exists(filename):
            new_file = filename
            print(f"\n✓ Found new ZIP list: {filename}")
            break

    if not new_file:
        print("\n✗ Could not find the new ZIP codes file!")
        print("\nPlease save your ~2500 ZIP codes file as one of:")
        for f in possible_new_files:
            print(f"  - {f}")
        print("\nThen run this script again.")
        return

    # Read existing ZIPs
    print(f"\nReading existing ZIP codes from: {existing_file}")
    existing_zips = set()

    try:
        with open(existing_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                zip_code = row.get('ZipCode', '').strip()
                if zip_code:
                    existing_zips.add(zip_code)
    except Exception as e:
        print(f"Error reading existing file: {e}")
        return

    print(f"✓ Loaded {len(existing_zips)} unique ZIP codes from existing list")

    # Read new ZIPs
    print(f"\nReading new ZIP codes from: {new_file}")
    missing_zips = []
    new_zip_count = 0

    try:
        with open(new_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            header = reader.fieldnames

            for row in reader:
                new_zip_count += 1
                zip_code = row.get('ZipCode', '').strip()

                # Only include if ZIP is not empty and not in existing list
                if zip_code and zip_code not in existing_zips:
                    missing_zips.append(row)
    except Exception as e:
        print(f"Error reading new file: {e}")
        return

    print(f"✓ Processed {new_zip_count} ZIP codes from new list")
    print(f"✓ Found {len(missing_zips)} ZIP codes that are MISSING from your existing list")

    # Write missing ZIPs to output
    if missing_zips:
        output_file = 'missing-texas-zips.csv'

        try:
            with open(output_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=header)
                writer.writeheader()
                writer.writerows(missing_zips)

            print(f"\n{'='*70}")
            print(f"SUCCESS! Created: {output_file}")
            print(f"{'='*70}")
            print(f"\nTotal missing ZIP codes: {len(missing_zips)}")
            print(f"\nFirst 25 missing ZIP codes:")
            print("-"*70)

            for i, row in enumerate(missing_zips[:25], 1):
                city = row.get('City', 'N/A')
                state = row.get('State', 'TX')
                pop = row.get('Population', 'N/A')
                print(f"{i:3}. {row['ZipCode']:5} - {city:25} {state:2}  (Pop: {pop:>6})")

            if len(missing_zips) > 25:
                print(f"\n... and {len(missing_zips) - 25} more ZIP codes")

            print("-"*70)
            print(f"\n✓ All {len(missing_zips)} missing ZIP codes saved to: {output_file}")
            print("="*70)

        except Exception as e:
            print(f"Error writing output file: {e}")
    else:
        print("\nNo missing ZIP codes found!")
        print("All ZIP codes in the new list are already in your existing list.")

if __name__ == '__main__':
    main()