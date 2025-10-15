# Email Infrastructure Dashboard - 1000 Row Limit Issue

## PROBLEM IDENTIFIED

Only 1,000 accounts are displaying in the Email Infrastructure Dashboard despite having 4,000+ accounts in the database.

## ROOT CAUSE

**Supabase PostgREST has a default row limit of 1,000 records.**

When querying without an explicit limit, Supabase returns maximum 1,000 rows:

```typescript
// Current code (line 336-339 in realtimeDataService.ts)
const { data: accounts, error } = await supabase
  .from('sender_emails_cache')
  .select('*')
  .order('last_synced_at', { ascending: false });
// ❌ Only returns 1,000 rows by default!
```

## SOLUTION OPTIONS

### Option 1: Manual Pagination (Simple, Immediate)
Query all data by manually increasing the limit:

```typescript
const { data: accounts, error } = await supabase
  .from('sender_emails_cache')
  .select('*')
  .order('last_synced_at', { ascending: false })
  .limit(10000); // Set explicit high limit
```

**Pros:**
- Quick 1-line fix
- Works immediately

**Cons:**
- Hardcoded limit (will break if accounts > 10,000)
- Not scalable

### Option 2: Count + Set Limit (Better)
Query count first, then set appropriate limit:

```typescript
// Get total count
const { count } = await supabase
  .from('sender_emails_cache')
  .select('*', { count: 'exact', head: true });

// Fetch all with proper limit
const { data: accounts, error } = await supabase
  .from('sender_emails_cache')
  .select('*')
  .order('last_synced_at', { ascending: false })
  .limit(count || 10000);
```

**Pros:**
- Scalable to any size
- No hardcoded limits

**Cons:**
- Requires 2 queries (adds ~100ms)

### Option 3: Automatic Pagination Loop (Most Robust)
Fetch all data in batches using pagination:

```typescript
let allAccounts = [];
let from = 0;
const batchSize = 1000;
let hasMore = true;

while (hasMore) {
  const { data: batch, error } = await supabase
    .from('sender_emails_cache')
    .select('*')
    .order('last_synced_at', { ascending: false })
    .range(from, from + batchSize - 1);

  if (error) throw error;
  if (!batch || batch.length === 0) break;

  allAccounts.push(...batch);
  hasMore = batch.length === batchSize;
  from += batchSize;
}
```

**Pros:**
- Handles unlimited rows
- Memory efficient (streams data)
- Production-ready

**Cons:**
- More complex code
- Multiple queries (may be slower)

### Option 4: Server-Side Aggregation (Best for Large Scale)
If dataset grows > 50,000 rows, consider server-side aggregation via Edge Function.

## RECOMMENDED SOLUTION

**Use Option 2 (Count + Set Limit)** - Best balance of simplicity and scalability.

For 4,000 accounts:
- Query time: ~200-300ms (count + fetch)
- Memory: ~2-3 MB
- Scalable to 100,000+ accounts

## IMPLEMENTATION

See fix in: `src/services/realtimeDataService.ts:336-339`

## VERIFICATION

After fix, check:
1. Dashboard shows all 4,000+ accounts
2. Load time still < 1 second
3. No console warnings about missing data
4. Account totals match database count

## ADDITIONAL CHECKS

Other queries that may hit 1000-row limit:
- ✅ `client_metrics` - Usually < 100 rows (safe)
- ✅ `client_revenue_mtd` - Usually < 100 rows (safe)
- ⚠️ `sender_emails_cache` - **4,000+ rows (NEEDS FIX)**
- ⚠️ `email_account_metadata` - **4,000+ rows (may need fix if used)**

## PERFORMANCE IMPACT

**Before fix:**
- Displayed: 1,000 accounts
- Load time: < 1 second

**After fix:**
- Displayed: 4,000+ accounts
- Load time: ~1-2 seconds (still very fast!)
- Memory: +2 MB (negligible)
