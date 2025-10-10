# Email Infrastructure Dashboard - Comprehensive Test Plan

**Date**: October 9, 2025
**Purpose**: Verify Email Infrastructure Dashboard displays all 4000+ email accounts with correct data
**Current Issue**: User reports only 1,000 accounts showing (Expected: 4,000+)

---

## 🎯 Test Objectives

1. **Verify Total Account Count**: Should show 4,000+ accounts (not 1,000)
2. **Verify Both Instances**: Confirm Maverick AND Long Run accounts are both displayed
3. **Verify All Workspaces**: Confirm all 24 active workspaces have accounts showing
4. **Verify Pricing Data**: Confirm prices are calculated correctly per reseller rules
5. **Verify Reply Rates**: Confirm reply rate percentages are displaying
6. **Verify Dashboard Cards**: Confirm all stat cards show correct aggregated data
7. **Verify Frontend Rendering**: Confirm UI displays all fetched data (no artificial limits)

---

## 🔍 Test Categories

### Category 1: Backend Data Verification (API/Database Layer)

**Objective**: Verify data source (Edge Function or Database) returns ALL accounts

#### Test 1.1: Verify Edge Function Returns Complete Data
```bash
# Test: Call hybrid-email-accounts-v2 Edge Function directly
# Expected: Returns 4000+ accounts in response

curl -X POST "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/hybrid-email-accounts-v2" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' \
  > /tmp/edge-function-response.json

# Count total records
jq '.records | length' /tmp/edge-function-response.json

# Expected: ~4000+ accounts
# If less: Edge Function is the problem
# If 4000+: Frontend filtering is the problem
```

**Success Criteria**:
- ✅ Returns 4000+ records
- ✅ Contains both Maverick and Long Run instances
- ✅ Contains all 24 workspace names

**Failure Scenarios**:
- ❌ Returns < 4000: Edge Function not fetching all workspaces
- ❌ Missing Maverick OR Long Run: API key issue
- ❌ Missing workspaces: Workspace not being processed

#### Test 1.2: Count Accounts by Bison Instance
```bash
# Test: Verify both instances are present in response
jq '.records | group_by(.fields["Bison Instance"]) |
    map({instance: .[0].fields["Bison Instance"], count: length})' \
    /tmp/edge-function-response.json
```

**Expected Output**:
```json
[
  {"instance": "Maverick", "count": 2600},
  {"instance": "Long Run", "count": 1400}
]
```

**Success Criteria**:
- ✅ Shows BOTH Maverick AND Long Run
- ✅ Maverick count ~2,600
- ✅ Long Run count ~1,400
- ✅ Total ~4,000+

#### Test 1.3: Count Accounts by Workspace
```bash
# Test: Verify all 24 workspaces have accounts
jq '.records | group_by(.fields["Workspace"]) |
    map({workspace: .[0].fields["Workspace"], count: length}) |
    sort_by(.count) | reverse' \
    /tmp/edge-function-response.json
```

**Expected Output**: 24 unique workspaces with varying counts

**Success Criteria**:
- ✅ Shows exactly 24 workspaces
- ✅ Includes: John Roberts, Kim Wallace, Devin Hodo, David Amiri, Danny Schwartz, etc.
- ✅ Each workspace has > 0 accounts

#### Test 1.4: Verify Pricing Data is Present
```bash
# Test: Check that Price field is populated (not all zeros)
jq '.records | map(.fields.Price) |
    {min: min, max: max, avg: (add/length),
     zeros: map(select(. == 0)) | length}' \
    /tmp/edge-function-response.json
```

**Expected Output**:
```json
{
  "min": 0.91,
  "max": 3.00,
  "avg": ~2.50,
  "zeros": <100  // Some accounts may legitimately have $0 (needs review)
}
```

**Success Criteria**:
- ✅ Min price >= $0.91 (Mailr accounts)
- ✅ Max price <= $3.00 (CheapInboxes/Zapmail)
- ✅ Average price ~$2.50
- ✅ < 5% accounts with $0 price

#### Test 1.5: Verify Reply Rate Data is Present
```bash
# Test: Check that reply rates are calculated (not all zeros)
jq '.records | map(.fields["Reply Rate Per Account %"]) |
    {min: min, max: max, avg: (add/length),
     with_data: map(select(. > 0)) | length,
     total: length}' \
    /tmp/edge-function-response.json
```

**Expected Output**:
```json
{
  "min": 0,
  "max": 100,
  "avg": ~5-15,
  "with_data": ~3000+,
  "total": 4000+
}
```

**Success Criteria**:
- ✅ Some accounts have > 0% reply rate
- ✅ Average reply rate is reasonable (5-15%)
- ✅ Max reply rate doesn't exceed 100%

---

### Category 2: Frontend Data Loading (dataService.ts)

**Objective**: Verify dataService correctly fetches and caches data

#### Test 2.1: Check Feature Flag Setting
```bash
# Test: Verify which data source is being used
grep -A3 "FEATURE_FLAGS.*=" src/services/dataService.ts | head -5
```

**Expected Output**:
```typescript
const FEATURE_FLAGS = {
  useRealtimeInfrastructure: false, // Should be false (using Edge Function)
```

**Success Criteria**:
- ✅ `useRealtimeInfrastructure: false` (using Edge Function with all data)

**If `true`**: Test database query instead:
```bash
curl -s "https://gjqbbgrfhijescaouqkx.supabase.co/rest/v1/sender_emails_cache?select=count" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Prefer: count=exact" -I | grep content-range
```

#### Test 2.2: Test fetchInfrastructureData() Function
```javascript
// Test: Open browser console on Email Infrastructure page
// Run: (paste in browser console)

// Clear cache
localStorage.clear();

// Fetch data
const { infrastructureDashboard } = useDashboardContext();
const result = await refreshInfrastructure();

console.log('Total accounts fetched:', infrastructureDashboard.emailAccounts.length);
console.log('Success:', result.success);
console.log('Cached:', result.cached);
console.log('Fresh:', result.fresh);

// Expected:
// Total accounts fetched: 4000+
// Success: true
```

**Success Criteria**:
- ✅ emailAccounts.length >= 4000
- ✅ success === true
- ✅ No console errors

#### Test 2.3: Check Network Request in DevTools
```
# Test: Manual browser test
1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Navigate to Email Infrastructure page
4. Find request to: hybrid-email-accounts-v2 OR sender_emails_cache
5. Check Response:
   - Status: 200 OK
   - Response size: Should be 5-10MB (large JSON)
   - Response contains: {"records": [...]} with 4000+ items
```

**Success Criteria**:
- ✅ Status code: 200
- ✅ Response size > 5MB
- ✅ Response has 4000+ records

---

### Category 3: Frontend Rendering (EmailAccountsPage.tsx)

**Objective**: Verify UI displays ALL fetched data without artificial limits

#### Test 3.1: Check for Pagination/Limiting Code
```bash
# Test: Search for any code that might limit display to 1000 rows
grep -n "\.slice\|\.limit\|1000\|1,000" src/pages/EmailAccountsPage.tsx
```

**Expected**: No artificial limits found

**Success Criteria**:
- ✅ No `.slice(0, 1000)` limiting array display
- ✅ No hardcoded 1000 limit anywhere

#### Test 3.2: Verify No Virtual Scrolling Limits
```bash
# Test: Check if virtual scrolling is limiting visible rows
grep -n "virtualiz\|window\|visible.*rows" src/pages/EmailAccountsPage.tsx
```

**Success Criteria**:
- ✅ Virtual scrolling (if used) doesn't limit to 1000 rows
- ✅ All rows are renderable (may not all be in DOM at once, but scrollable)

#### Test 3.3: Check Dashboard Stat Cards
```javascript
// Test: Browser console on Email Infrastructure page
const { infrastructureDashboard } = useDashboardContext();
const { emailAccounts } = infrastructureDashboard;

// Check stats
console.log('Total Accounts:', emailAccounts.length);
console.log('Total Price:', emailAccounts.reduce((sum, acc) => sum + (parseFloat(acc.fields.Price) || 0), 0));
console.log('Connected:', emailAccounts.filter(acc => acc.fields.Status === 'connected').length);
console.log('Disconnected:', emailAccounts.filter(acc => acc.fields.Status !== 'connected').length);

// Check if stats match what's displayed on page
```

**Success Criteria**:
- ✅ Console totals match dashboard card displays
- ✅ Total Accounts card shows 4000+
- ✅ Total Price card shows realistic value (not $0)
- ✅ Connected/Disconnected counts are reasonable

#### Test 3.4: Test Account Filtering
```javascript
// Test: Apply filters and verify counts
const { setInfrastructureFilter } = useDashboardContext();

// Filter by client
setInfrastructureFilter({ selectedClientForSending: 'John Roberts' });
// Check: Should show only John Roberts accounts

// Filter by provider
setInfrastructureFilter({ selectedProviderView: 'Gmail' });
// Check: Should show only Gmail accounts

// Clear filters
setInfrastructureFilter({ selectedClientForSending: 'All Clients', selectedProviderView: 'all' });
// Check: Should show ALL 4000+ accounts again
```

**Success Criteria**:
- ✅ Filters work correctly
- ✅ "All Clients" shows 4000+ accounts
- ✅ Filtering doesn't permanently hide accounts

#### Test 3.5: Test Account Export (CSV Download)
```javascript
// Test: Export all accounts and verify count
// Click "Download 0% Reply Rate Accounts" button or similar export
// Check exported CSV row count

// Alternative: Check code
grep -A20 "downloadZeroReplyRateAccounts\|export.*csv" src/pages/EmailAccountsPage.tsx
```

**Success Criteria**:
- ✅ Export includes ALL filtered accounts (not limited to 1000)
- ✅ CSV row count matches UI displayed count

---

### Category 4: Data Transformation (fieldMappings.ts)

**Objective**: Verify data transformation doesn't drop records

#### Test 4.1: Verify Transform Function
```bash
# Test: Check transformToEmailAccount function
grep -A30 "export function transformToEmailAccount" src/lib/fieldMappings.ts
```

**Success Criteria**:
- ✅ Function doesn't filter/skip any accounts
- ✅ All required fields are mapped
- ✅ No conditional returns that might skip records

#### Test 4.2: Test Transform with Sample Data
```javascript
// Test: Browser console
import { transformToEmailAccount } from '@/lib/fieldMappings';

// Sample raw data
const sampleRaw = {
  id: 'test-1',
  email_address: 'test@example.com',
  status: 'connected',
  emails_sent_count: 100,
  reply_rate_percentage: 5.5,
  price: 3.00,
  // ... other fields
};

const transformed = transformToEmailAccount(sampleRaw);
console.log('Transformed:', transformed);
// Check: All fields present
```

**Success Criteria**:
- ✅ Transformation succeeds
- ✅ All fields are present in output
- ✅ No errors thrown

---

### Category 5: Integration Test (End-to-End)

**Objective**: Verify complete data flow from API → Frontend → UI

#### Test 5.1: Full Page Load Test
```
Manual Test Steps:
1. Clear browser cache (Ctrl+Shift+Del)
2. Clear localStorage (Console: localStorage.clear())
3. Hard refresh page (Ctrl+Shift+R)
4. Wait for page to fully load
5. Check dashboard cards:
   - Total Accounts: Should show 4000+
   - Total Price: Should show $8,000-$12,000
   - Average Cost Per Client: Should show $300-$500
6. Scroll through account list
   - Verify you can scroll past 1000 rows
   - Verify accounts continue loading
7. Check browser console for errors
8. Check Network tab:
   - Response size of data fetch
   - Any failed requests
```

**Success Criteria**:
- ✅ Page loads without errors
- ✅ Dashboard shows 4000+ total accounts
- ✅ All 24 workspaces visible in filters
- ✅ Can scroll through all accounts
- ✅ No console errors

#### Test 5.2: Performance Test
```javascript
// Test: Measure load time
console.time('InfrastructureLoad');
// Refresh page or trigger data fetch
// Wait for completion
console.timeEnd('InfrastructureLoad');

// Expected: 30-60 seconds (Edge Function is slow but has all data)
```

**Success Criteria**:
- ✅ Load completes within 60 seconds
- ✅ All data loaded (no partial load)

#### Test 5.3: Data Accuracy Spot Check
```
Manual Test:
1. Pick 5 random email accounts from different workspaces
2. For each account, verify:
   - Email address displayed correctly
   - Workspace name matches
   - Price is reasonable ($0.91 - $3.00)
   - Reply rate is calculated (if sent > 0)
   - Status is shown
3. Cross-reference 2-3 accounts with Email Bison directly
```

**Success Criteria**:
- ✅ All spot-checked accounts display correctly
- ✅ Data matches Email Bison source

---

## 🐛 Known Issues to Check

### Issue 1: Only 1000 Accounts Showing
**Symptoms**: User reports only 1000 accounts visible
**Possible Causes**:
1. Frontend pagination limiting display
2. Virtual scrolling with 1000 row limit
3. Browser memory limit truncating data
4. Edge Function returning truncated response
5. Data validation dropping some records

**Tests**:
- Run Test 1.1 to verify Edge Function returns 4000+
- Run Test 3.1 to check for artificial limits
- Run Test 5.1 to verify UI displays all data

### Issue 2: Missing Maverick Accounts
**Symptoms**: Only Long Run accounts showing
**Tests**:
- Run Test 1.2 to verify both instances present

### Issue 3: Missing Pricing Data
**Symptoms**: Prices show as $0 or missing
**Tests**:
- Run Test 1.4 to verify pricing in API response
- Check CheapInboxes accounts: Should be $3.00
- Check Mailr accounts: Should be $0.91
- Check ScaledMail accounts: Should vary by domain

### Issue 4: Missing Reply Rates
**Symptoms**: Reply rates all show 0%
**Tests**:
- Run Test 1.5 to verify reply rates calculated
- Check accounts with emails_sent > 0

---

## 📋 Test Execution Checklist

### Pre-Test Setup
- [ ] Verify dev server is running: `npm run dev`
- [ ] Verify SUPABASE_KEY environment variable is set
- [ ] Verify browser DevTools are open (F12)
- [ ] Clear browser cache and localStorage

### Execute Backend Tests (Category 1)
- [ ] Test 1.1: Edge Function returns complete data
- [ ] Test 1.2: Count by Bison instance
- [ ] Test 1.3: Count by workspace (24 expected)
- [ ] Test 1.4: Verify pricing data present
- [ ] Test 1.5: Verify reply rate data present

### Execute Frontend Loading Tests (Category 2)
- [ ] Test 2.1: Check feature flag setting
- [ ] Test 2.2: Test fetchInfrastructureData()
- [ ] Test 2.3: Check network request in DevTools

### Execute Frontend Rendering Tests (Category 3)
- [ ] Test 3.1: Check for limiting code
- [ ] Test 3.2: Verify no virtual scrolling limits
- [ ] Test 3.3: Check dashboard stat cards
- [ ] Test 3.4: Test account filtering
- [ ] Test 3.5: Test account export

### Execute Transformation Tests (Category 4)
- [ ] Test 4.1: Verify transform function
- [ ] Test 4.2: Test transform with sample data

### Execute Integration Tests (Category 5)
- [ ] Test 5.1: Full page load test
- [ ] Test 5.2: Performance test
- [ ] Test 5.3: Data accuracy spot check

---

## 📊 Test Report Template

```markdown
## Test Execution Results

**Date**: [Date]
**Tester**: [Name]
**Environment**: Production / Development

### Summary
- Total Tests: X
- Passed: Y
- Failed: Z
- Blocked: W

### Critical Findings

#### Finding 1: [Issue Title]
- **Severity**: Critical / High / Medium / Low
- **Test**: [Test ID]
- **Expected**: [Expected result]
- **Actual**: [Actual result]
- **Evidence**: [Screenshot/logs]
- **Root Cause**: [Analysis]
- **Fix Required**: [Description]

### Test Results by Category

#### Category 1: Backend (5 tests)
- Test 1.1: ✅ PASS - Edge Function returns 4,123 accounts
- Test 1.2: ❌ FAIL - Only Long Run accounts present (Maverick missing)
- Test 1.3: ⚠️ PARTIAL - Only 10/24 workspaces found
- Test 1.4: ✅ PASS - Pricing data present and correct
- Test 1.5: ✅ PASS - Reply rates calculated correctly

[Continue for all categories...]

### Recommendations
1. [Recommendation based on findings]
2. [Next steps]
3. [Additional testing needed]
```

---

## 🎯 Success Criteria (Overall)

### Must Have (P0 - Blocking Issues)
- ✅ Dashboard displays 4,000+ total accounts
- ✅ Both Maverick AND Long Run accounts visible
- ✅ All 24 workspaces have accounts showing
- ✅ Dashboard stat cards show correct totals
- ✅ No console errors on page load

### Should Have (P1 - Important)
- ✅ Pricing data present and accurate
- ✅ Reply rates calculated correctly
- ✅ Page loads within 60 seconds
- ✅ Account filtering works correctly
- ✅ Export functionality includes all accounts

### Nice to Have (P2 - Enhancement)
- ✅ Load time < 30 seconds
- ✅ Smooth scrolling through all accounts
- ✅ Real-time data updates (future)

---

## 🔧 Debugging Tools

### Tool 1: Account Count Checker
```bash
#!/bin/bash
# Quick script to check account counts

echo "=== Email Infrastructure Account Count Test ==="
echo ""

# Test Edge Function
echo "1. Testing Edge Function..."
RESPONSE=$(curl -s -X POST "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/hybrid-email-accounts-v2" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}')

TOTAL=$(echo "$RESPONSE" | jq '.records | length')
MAVERICK=$(echo "$RESPONSE" | jq '.records | map(select(.fields["Bison Instance"] == "Maverick")) | length')
LONGRUN=$(echo "$RESPONSE" | jq '.records | map(select(.fields["Bison Instance"] == "Long Run")) | length')
WORKSPACES=$(echo "$RESPONSE" | jq '.records | map(.fields.Workspace) | unique | length')

echo "   Total Accounts: $TOTAL"
echo "   Maverick: $MAVERICK"
echo "   Long Run: $LONGRUN"
echo "   Unique Workspaces: $WORKSPACES"
echo ""

if [ "$TOTAL" -lt 4000 ]; then
  echo "❌ FAIL: Total accounts less than 4000"
else
  echo "✅ PASS: Total accounts >= 4000"
fi

if [ "$WORKSPACES" -ne 24 ]; then
  echo "❌ FAIL: Expected 24 workspaces, found $WORKSPACES"
else
  echo "✅ PASS: All 24 workspaces present"
fi
```

### Tool 2: Browser Console Test Suite
```javascript
// Paste in browser console on Email Infrastructure page

async function runEmailInfraTests() {
  console.log('🧪 Running Email Infrastructure Tests...\n');

  // Test 1: Check total accounts
  const totalAccounts = infrastructureDashboard.emailAccounts.length;
  console.log(`Total Accounts: ${totalAccounts}`);
  console.log(totalAccounts >= 4000 ? '✅ PASS' : '❌ FAIL - Expected 4000+\n');

  // Test 2: Check instances
  const byInstance = {};
  infrastructureDashboard.emailAccounts.forEach(acc => {
    const instance = acc.fields['Bison Instance'] || 'Unknown';
    byInstance[instance] = (byInstance[instance] || 0) + 1;
  });
  console.log('By Instance:', byInstance);
  console.log(Object.keys(byInstance).length === 2 ? '✅ PASS' : '❌ FAIL - Expected Maverick AND Long Run\n');

  // Test 3: Check workspaces
  const workspaces = new Set(infrastructureDashboard.emailAccounts.map(acc => acc.fields.Workspace));
  console.log(`Unique Workspaces: ${workspaces.size}`);
  console.log(workspaces.size === 24 ? '✅ PASS' : '❌ FAIL - Expected 24 workspaces\n');

  // Test 4: Check pricing
  const withPrice = infrastructureDashboard.emailAccounts.filter(acc => acc.fields.Price > 0).length;
  console.log(`Accounts with Price > $0: ${withPrice} (${(withPrice/totalAccounts*100).toFixed(1)}%)`);
  console.log(withPrice > totalAccounts * 0.95 ? '✅ PASS' : '⚠️ WARNING - Less than 95% have pricing\n');

  // Test 5: Check reply rates
  const withReplyRate = infrastructureDashboard.emailAccounts.filter(acc =>
    acc.fields['Total Sent'] > 0 && acc.fields['Reply Rate Per Account %'] >= 0
  ).length;
  console.log(`Accounts with Reply Rate: ${withReplyRate}`);
  console.log(withReplyRate > 0 ? '✅ PASS' : '❌ FAIL - No reply rates calculated\n');

  console.log('🏁 Tests Complete');
}

runEmailInfraTests();
```

---

## 📝 Next Steps After Testing

1. **If all tests pass**: Document success, mark issue as resolved
2. **If backend tests fail**: Fix Edge Function or database query
3. **If frontend tests fail**: Fix React components, remove limits
4. **If integration tests fail**: Check network, CORS, authentication

Once issues are identified, create specific fix plans for each failure.
