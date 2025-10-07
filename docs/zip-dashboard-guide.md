# 🗺️ ZIP Code Dashboard - User Guide

## Overview

The ZIP Code Dashboard provides an interactive US map visualization for managing ZIP code assignments across different agencies. Features include:

- **Interactive US Map** - States colored by agency assignments
- **Agency Management** - Assign ZIPs, manage colors, track stats
- **Advanced Filtering** - Filter by state, agency, or search
- **CSV Export** - Download current view as CSV

## Accessing the Dashboard

Navigate to: **http://localhost:5173/zip-dashboard**

## Features

### 1. Stats Overview

Three cards at the top show:
- **Total ZIPs** - All ZIPs in database for selected month
- **Assigned** - ZIPs with agency assignments (green)
- **Unassigned** - ZIPs without assignments (orange)

### 2. Interactive US Map

**Left Panel - Map Visualization:**
- States are colored by the **dominant agency** in that state
- Gray states = unassigned ZIPs
- Hover over states to see boundaries highlighted
- Click a state to view and assign ZIPs

**Legend:**
- Shows all agencies and their assigned colors
- Unassigned ZIPs shown in gray

### 3. Agency Assignments Table

**Right Panel - Agency List:**
- View all agencies with ZIP assignments
- See ZIP count per agency
- Change agency colors using the color picker

**Change Agency Color:**
1. Click "Change Color" button next to agency
2. Select from preset colors OR enter custom hex code
3. Color updates immediately on map

### 4. Filters & Search

**Filter Bar Features:**
- **Search** - Find specific ZIP codes or agency names
- **State Filter** - Show only ZIPs from selected state
- **Agency Filter** - Show only ZIPs for selected agency
- **Export CSV** - Download filtered data

### 5. ZIP Assignment

**To assign a ZIP to an agency:**
1. Click on a state in the map
2. Modal opens showing the ZIP code
3. Select agency from dropdown
4. Click "Assign"

**Note:** Currently assigns the first ZIP in clicked state. Future update will show state-level ZIP list.

## Importing ZIPs with Colors

### CSV Format

Your CSV should include these columns:
- **Client** or **Agency** - Agency name
- **ZIP** or **Zip Code** - ZIP code
- **Color** (optional) - Hex color code (e.g., `#FF5733`)

Example CSV:
```csv
Client,ZIP,Color
Agency A,07001,#EF4444
Agency A,07002,#EF4444
Agency B,10001,#10B981
Agency B,10002,#10B981
```

### Import Command

```bash
node scripts/import-zip-codes.mjs "/path/to/file.csv" "2025-11" \
  --client-col "Client" \
  --zip-col "ZIP" \
  --color-col "Color"
```

**Arguments:**
- First arg: Absolute path to CSV file
- Second arg: Month in `YYYY-MM` format
- `--client-col`: Column name for agency (default: "Client")
- `--zip-col`: Column name for ZIP code (default: "ZIP")
- `--color-col`: Column name for color (default: "Color", optional)

**Default column names recognized:**
- **Client**: Client, ClientName, Name, Territory, Agency, Workspace
- **ZIP**: ZIP, ZipCode, Zip_Code, ZipCodes, Postal, PostalCode
- **Color**: Color, Colour, AgencyColor, Agency_Color, Hex

### Without Colors

If your CSV doesn't have colors:
```bash
node scripts/import-zip-codes.mjs "/path/to/file.csv" "2025-11"
```

Colors can be assigned later via the dashboard's color picker.

## Database Schema

### Table: `client_zipcodes`

```sql
- id: bigserial (primary key)
- client_name: text (agency name)
- workspace_name: text (optional workspace identifier)
- month: text (YYYY-MM format)
- zip: text (ZIP code)
- state: text (2-letter state code)
- agency_color: text (hex color code) -- NEW FIELD
- source: text (default: 'csv')
- pulled_at: timestamptz
- agent_run_id: uuid (nullable)
- inserted_at: timestamptz
```

## Tips & Best Practices

1. **Consistent Colors**: Use the same color for an agency across all months for visual consistency
2. **Color Palette**: The dashboard provides 12 preset colors optimized for visibility
3. **Bulk Updates**: To change all ZIPs for an agency, just update the agency color in the table
4. **CSV Exports**: Use exports for reporting or sharing with clients
5. **Month Navigation**: Use the month selector (top right) to view historical data

## Troubleshooting

### "No data for [month]" message
- Check that ZIPs have been imported for this month
- Verify month format is `YYYY-MM` (e.g., `2025-11`)

### Map shows all gray
- ZIPs imported but colors not assigned
- Use the color picker to assign colors to agencies

### Import script fails
- Verify CSV file path is absolute
- Check CSV has required columns (ZIP at minimum)
- Ensure Supabase credentials in `.env` are correct

## Future Enhancements

Planned features:
- ZIP-level detail view (click state → see all ZIPs in that state)
- Bulk assignment (select multiple ZIPs → assign to agency)
- State-level assignment (assign all ZIPs in state to agency)
- Historical comparison (compare current month vs previous)
- Coverage heat map (show assignment density)

## Support

For issues or questions:
- Check database migrations are up to date
- Verify `agency_color` column exists in `client_zipcodes` table
- Review browser console for errors
- Check Supabase dashboard for RLS policy issues
