# Home Insurance Campaign Management SOP

## Objective / Context

We pull homeowner lists from **Cole X Dates** and email them about **4 weeks (28–34 days)** before their Renewal Date. Our email plan is **3 messages in one thread**: Day 1, Day 10, Day 20. Sending at the right time is how we get replies.

**Steps 1-4 need to be completed on the 15th of each month in sequential order.**

---

## Roles & Ownership

- **Primary Owner**: Campaign Manager B2C
  *If you are unable to complete this, please notify the Head of Fulfillment for B2C immediately.*
- **Backup**: Head of Fulfillment for B2C: Thomas Chavez

---

## Prerequisites

### Access Requirements
**Logins live in Airtable → Password Library**: https://airtable.com/appONMVSIf5czukkf/pagkVNO14hrJQjBHn

Required access:
- Cole X Dates (account required)
- Clay (our data tool). All downloads from Cole go into Clay
- Client Zipcode Database (Google Sheets + Airtable)
- Google Sheets → Data Pull Log (read/write)

### Required Client Inputs
**See the client status table in Airtable. If something is missing, tell Head of Fulfillment:**

- Licensed state(s) for the agency
- Approved ZIP code list (CSV or Google Sheet) — link is in the Airtable profile
- Package tier: 100 replies/mo or 200 replies/mo
- Any extra filters (ex: Home Value, Purchase Year, Years at Address)

---

## Monthly Cadence

**Monthly: On the 15th of each month**, pull unrefined contacts from Cole X Dates, upload all files to Clay, and format them. Then upload 4 separate files for each week of the following month to Email Bison.

**Example**: If today is Jan 15 and we run Feb renewals, pull Mar renewals now, format in Clay, and have them ready by Feb 1.

---

## Key Definitions

- **Renewal Window (RW)**: The 7-day range of Renewal Dates we will email ~4 weeks early. We cannot upload a whole month at once because our platform assigns send windows randomly.

- **Batch Week**: The 7-day renewal range we add to a campaign every Monday. The last batch in a month may be shorter or longer to reach the month-end.

- **Target Volume**:
  - 100 leads/month campaigns → 1750 emails daily OR 45,000 emails monthly
  - 200 leads/month campaigns → 3500 emails daily OR 90,000 emails monthly

- **Required Refined Contacts**:
  - 100 leads/month → 15,000 cleaned, verified, uploaded to Email Bison monthly
  - 200 leads/month → 30,000 cleaned, verified, uploaded to Email Bison monthly

---

## SOP PT 1: Pulling Data in Cole X Dates

**Loom Pt. 1**: SOP Training: Pulling Data from COLEX States
**Loom Pt. 2**: [Link from original doc]

### 1) Log In & Create a New Query
- Open: https://coleinformation.com/products/cole-x-dates/
- Get the password in Airtable here **SEPARATE STATES HAVE DIFFERENT LOGINS**: https://airtable.com/appONMVSIf5czukkf/pagkVNO14hrJQjBHn
- Create a new search/query

### 2) Making a Data Request
- **States**: Choose only states where the client is licensed
- **Type of list**: Emailing
- **ZIP codes**: Paste or upload the approved ZIP list from the client status tab in Airtable. If it's missing, ping Head of Fulfillment to set it up
- **Formatted ZipCodes for Maps**: The UI wants commas with no spaces, use: `75034,75035,75036,...`
- **⚠️ Very important**: If the search returns more than 10,000 records, you must split the search. Reduce the number of ZIPs, download <10,000, then repeat with the rest until you have all data for those ZIPs.

### 3) Required Fields Selection (13 total view)
If your screen shows a 13-field selection view, pick exactly these Advanced options in the top right:

- First_Name
- Last_Name
- Address_1
- City
- State
- Zip
- Cell Phone Number
- Email_Address
- Purchase_Date (MM/DD/YYYY)
- Home_Value
- Head_Household
- Income
- Date_of_Birth

### 4) Add Extra Filters (only if the client needs them)
- Examples: Ethnicity, Purchase Year, etc.
- Check the client status page in Airtable for what to add

### 5) Export from COLE X DATES
- Always export < 10,000 contacts at a time
- Select all records
- Download to Computer
- CSV (with headers)
- Repeat until you've pulled all ZIPs for this client

### 6) Uploading to Clay
- Log in to Clay (request access if needed) clay.com
- Go to B2C folder → the Client folder (ex: Kim Wallace)
- Top right: click **New → Folder**
- Title: **Month** (the month you're uploading)
- Top right: click **New → Workbook**
- Bottom: click **+Add → Import from CSV** → upload the first file
- After it loads: **Actions** (top right) → **Import → Import from CSV** → upload the second file
- Set **Delimiter = Comma**, choose **Add to current table**, then **Continue**
- You should have 13 column headers in this table view
- Click **Add to table → Save and run rows in this CSV**
- Repeat this process for all downloads associated with this client
- Record the date the Zip codes are pulled in the Zip code sheet under the clients tab
- **⚠️ Never put more than 40,000 contacts in one table**. If close to 40,000, click **+Add** at the bottom to make a new blank table, then repeat steps 5–10

### ✅ Completion (for this step)
Move to **Step 2: Clay Formatting & Enrichment** only after:

- All client ZIP codes for the month are fully pulled
- You marked and recorded which ZIP codes were pulled for that month
- You posted this in **Client Success channel** for each client:

```
✅ Raw Pull Complete
👤 Client: <Client Name>
📅 Renewal Month: <Month pulled>
📊 Records Exported: <count>
👤 Pulled by: <Your name>
```

---

## SOP PT 2: Formatting Leads in Clay

**Loom Part 1**: Formatting Tables and Data Management in Clay 📊
**Loom Part 2**: Mapping Email Addresses for Campaigns 📧

### Notes
- New columns will be added during this step. You should start with 13
- Use the `/` forward slash to reference a column in a formula (ex: `/Home Value`, `/Purchase Date`)

### Filters and Formulas

#### 1. Keep only Head of Household
- Click **Filters** → choose **Head_Household** → **is not empty**
- This usually cuts the list about in half

#### 2. Numeric Home Value
- Right-click **Home_Value** header → **Insert 1 column right** → **Formula**
- Describe: *"Take the Home Value from /Home Value and convert it into just a number."*
- Click **Generate Formula** → if correct, **Save and run all rows in this view**

#### 3. Filter by price
- Filter **Numeric Home Value** → **less than or equal to** → **900,000**
- **Texas only**: Homes over $900,000 must be downloaded into a separate sheet for our High Net Worth client (watch the Loom)

#### 4. Readable Purchase Date
- Right-click `/Purchase Date` → **Insert 1 column right** → **Formula**
- Describe: *"Take the date from /Purchase Date and give me back just the month and the day (ex: 08/03/2023 → "August 3rd")."*

#### 5. Purchase Day (number only)
- Right-click `/Purchase Date` → **Insert 1 column right** → **Formula**
- Describe: *"Take the date from /Purchase Date and return only the day of the month (ex: 08/03/2023 → 3)."*
- **We use this to filter by Renewal Date week when we upload each Monday**

#### 6. Validate emails with Debounce
- Click **Add enrichment** (top right) → search **Debounce** → **Validate Email**
- Column mapping: type `/` and choose **Email_Address**
- **Continue to add fields** → toggle **First Safe To Send Email**
- **Save** → **Save and run # rows in this view**
- After ~1 hour, add a filter: **first safe to send email** → **is not empty** (these are the good emails)
- **Repeat these steps for every sheet in the client's workbook for that month**

### ✅ Completion (for Step 2)
Move to **Step 3: Uploading Contacts to Bison** only after:

- All sheets in the workbook are correctly formatted
- You have enough refined contacts for the package: **11,500** (100 replies) or **23,000** (200 replies)
- Post this in **Client Success**:

```
✅ Data Refinement Complete
👤 Client: <Client Name>
📅 Renewal Month: <Month pulled>
📊 Refined contacts for the month: <count>
👤 Pulled by: <Your name>
```

---

## SOP PT 3: Reviewing Totals

**Loom**: Formatted ZipCodes for Maps - Google Sheets

- After cleaning, tally totals and post in Client Success so we know we're ready for next month
- For **(100 leads/mo)** 15,000 refined contacts are needed
- For **(200 leads/mo)** 30,000 refined contacts are needed
- If under target: see **Volume Planning & Gap Fills**
- If over target: Please Note the total that we are over by in the **Formatted Zipcodes Sheet** under the total for the month tab
- If we have no more ZIP codes, alert the Head of Fulfillment

### Volume Planning & Gap Fills

#### If below target:
- If there are multiple clients in a state, and one client has more leads than the other, move some of the ZIP Codes to the other Client
- Expand ZIP radius → use adjacent ZIPs that the Account Lead pre-approved (ping Head of Fulfillment in Slack)
- Add state regions → include more counties/ZIPs in licensed states (ping Head of Fulfillment)
- Widen filters → relax things like Years at Address or Home Value within rules (ping Head of Fulfillment)
- Add secondary licensed states only if approved in the contract (ping Head of Fulfillment)
- Log all changes in the state master sheet (ping Head of Fulfillment)

#### If over target:
- Sample evenly by ZIP to keep balance
- Also tell us so we can upsell clients. **Bonuses apply** 💰

---

## SOP PT 4: Uploading Leads to Email Bison

**Upload weekly, not monthly.** Update: same logic still applied.

**Loom**: [Link from original doc]

### Overview
We need to upload **four different batches** of leads to Email Bison for each client in their respective workspaces once SOP PT 1 and 2 are completed. This will allow us to natively add the leads to the Evergreen campaign at the beginning of each week using Email Bison, eliminating the need to reformat data within Clay before downloading and uploading it again.

### Renewal Window Logic (how to pick dates)
On each **Monday** (Upload Day = M):
- **RW_start** = M + 28 days
- **RW_end** = M + 34 days (7-day range)
- **Exception**: For the last batch in a month, set RW_end to the end of the month

#### Examples
- Mon Jan 1 → Feb 1–7
- Mon Jan 8 → Feb 8–14
- Mon Jan 15 → Feb 15–21
- Mon Jan 22 → Feb 22–Feb 29 (or 28)

### Selecting the right ZIP/date window in Clay
- Once SOP Steps 1 and 2 are completed for a client, we need to upload four different batches of leads to Email Bison so we can simply add them to a campaign natively within Bison at the start of each week
- Use filters for the correct week of next month. **Example**: On Jan 1, upload Feb 1–7

#### Filters by week (use your "Purchase Day" column):
- **1st–7th**: Filter **Purchase Day** → **less than or equal to** → **7**
- **8th–14th**: Keep the first filter. Add second filter **Purchase Day** → **less than or equal to** → **14**
- **15th–21st**: Change the two values to 15 and 21 (see Loom)
- **22nd–end**: Filter **Purchase Day** → **greater than or equal to** → **21**

### Uploading process
1. Apply the week filters
2. **Actions** → **Export** → **Download CSV**
3. Open **Email Bison** → client portal → **Contacts** → **Import new contacts**
4. Drag/drop the CSV. Name it: `(February 1st - 7th renewals)` (use the real dates)
5. Repeat this step for the other 3 renewal windows in the month. **(4 total uploads)**

### Map these fields in Email Bison every time
- First name
- Last name
- Email
- DOB
- Street address
- City
- State
- ZIP
- Renewal Date
- Cellphone
- Street address (if separate Street/House fields exist, map accordingly)
- Home Value

### ✅ Slack Update Template
(after four lists have been uploaded to the Contacts tab in Bison)

```
✅ Refined Data Uploaded
👤 Client: <Client Name>
📅 4 Renewal Windows:
Week 1 <MM/DD>–<MM/DD>
Week 2 <MM/DD>–<MM/DD>
Week 3 <MM/DD>–<MM/DD>
Week 4 <MM/DD>–<MM/DD>
📊 Records Exported: <count> (Target: <12k|24k>)
👤 Uploaded by: <Name>
```

---

## SOP PT 5: Adding leads to the Evergreen campaign

**Loom Video Training**: Home Insurance Campaign Management: Step 5 Overview 📅

### Cadence
- **When**: Every Monday at the start of your shift (default: 9:00 AM CT)
- If Monday is a holiday, complete on the next business day

### Steps

#### 1) Open the correct evergreen campaign
- In the client's Email Bison workspace, go to **Campaigns**
- Open `"Evergreen, Last Upload: {Month} {Start–End}"` (e.g., "Evergreen, Last Upload: January 1–7")
- Use that title to determine the next 7-day renewal window
- **Example**: If it's Mon, Jan 8, add Jan 8–14

#### 2) Add the correct contacts
- Inside the campaign, click **Actions** (top right) → **Add more contacts**
- In the picker, scroll to the renewal file/timeframe you created in Step 4 and select the matching 7-day window
- Click **Add** to attach those contacts to the evergreen campaign

#### 3) Edit the campaign name
- Click **Actions** (top right) → **Rename**
- Remove the previous week's window from the title and replace it with the new window
- **Naming format**: `Evergreen, Last Upload: {Month} {Start–End}`
- **Example**: rename from "Evergreen, Last Upload: September 24–30" to "Evergreen, Last Upload: October 1–7" (use actual calendar dates)

#### 4) Post completion notice in Slack
- Post in your team channel (e.g., #Client-success) using the template below
- Include: client name(s), renewal window(s) added, contact counts, and any exceptions

### ✅ Slack template (copy/paste):
```
Evergreen uploads completed

Clients: {Client A, Client B, …}

Window(s) added: {Jan 8–14}

Counts: {Client A: 3,120 | Client B: 2,940}

Notes/Exceptions: {none | brief note}

All contacts are queued in "Evergreen, Last Upload: {Month Day–Day}" for each client.
```

### Definition of Done
- All assigned insurance clients have the current week's 7-day renewal window uploaded to their Evergreen campaign in Email Bison
- And the Slack completion notice (above) has been posted to the team channel

---

## Automation Opportunities

### High-Priority Automation Targets
1. **Cole X Dates → Clay sync** (Step 1)
2. **Clay data transformations** (Step 2)
3. **Volume validation & gap detection** (Step 3)
4. **Weekly batch upload to Email Bison** (Step 4)
5. **Monday evergreen campaign updates** (Step 5)

### Integration Points
- **Cole X Dates API** (if available)
- **Clay API** (data import/export)
- **Email Bison API** (contact import, campaign management)
- **Airtable API** (client config, logging)
- **Slack API** (notifications)
