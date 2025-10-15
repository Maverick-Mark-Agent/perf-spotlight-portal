# API Key Usage Guide - Infrastructure Dashboard

**Question:** Can someone use the workspace-specific API keys stored in Supabase to edit the infrastructure dashboard, or do they need to create new API keys?

---

## Answer: ✅ They SHOULD Use the Stored Workspace-Specific API Keys

### Why the Stored Keys Are the Right Choice:

#### 1. **Purpose of Stored Keys**
The 25 workspace-specific API keys stored in `client_registry.bison_api_key` are specifically intended for:
- ✅ Fetching data from Email Bison API
- ✅ Syncing email accounts for the infrastructure dashboard
- ✅ Managing workspace-specific webhooks
- ✅ ANY programmatic access to Email Bison data

#### 2. **Current Infrastructure Dashboard Implementation**

The infrastructure dashboard uses **TWO super admin API keys** (stored as environment variables):
- `EMAIL_BISON_API_KEY` - Maverick instance super admin key
- `LONG_RUN_BISON_API_KEY` - Long Run instance super admin key

**Location:** These are used in the Edge Function: `hybrid-email-accounts-v2`

**How it works:**
```typescript
// Current implementation (hybrid-email-accounts-v2/index.ts)
const emailBisonApiKey = Deno.env.get('EMAIL_BISON_API_KEY'); // Super admin key
const longRunBisonApiKey = Deno.env.get('LONG_RUN_BISON_API_KEY'); // Super admin key

// Loops through ALL workspaces using super admin keys
for (const workspace of workspaces) {
  // Switch to workspace context
  // Fetch sender emails
}
```

---

## Should They Use Workspace-Specific Keys or Create New Ones?

### ✅ RECOMMENDED: Use the Workspace-Specific Keys Stored in Supabase

**Why:**
1. **Already Available** - 25 keys already stored and ready to use
2. **Workspace Scoped** - Each key can only access its own workspace (safer)
3. **Better Architecture** - Matches our webhook implementation
4. **No Super Admin Needed** - Removes dependency on super admin keys
5. **Better Audit Trail** - Know exactly which workspace made which API call

**When to use them:**
- Fetching data for a **specific client/workspace**
- Updating email accounts for **one workspace**
- Any workspace-specific operations

### ⚠️ When Super Admin Keys Are Actually Needed:

**Only use super admin keys when you need to:**
- Fetch data from **ALL workspaces at once** (like the current infrastructure dashboard does)
- Manage workspaces themselves (create, delete, rename)
- Perform cross-workspace operations
- Initial setup tasks

---

## Implementation Options for Infrastructure Dashboard

### Option 1: Keep Current Approach (Super Admin Keys)
**Status:** Currently implemented

**Pros:**
- ✅ Fetches ALL workspaces in one pass
- ✅ No need to loop through workspace keys
- ✅ Simple implementation

**Cons:**
- ❌ Requires super admin access
- ❌ Less secure (one key accesses everything)
- ❌ Harder to audit which workspace was accessed

**Use when:** Fetching infrastructure data for ALL clients at once

---

### Option 2: Use Workspace-Specific Keys (Recommended for Single Client Updates)
**Status:** Keys available in database

**Pros:**
- ✅ More secure (workspace isolation)
- ✅ Better audit trail
- ✅ Matches webhook architecture
- ✅ Can revoke/rotate per workspace

**Cons:**
- ❌ Need to fetch each workspace separately
- ❌ Slower if fetching all workspaces
- ❌ More complex implementation

**Use when:**
- Updating ONE specific client's data
- Building client-specific features
- Need workspace isolation

---

## Practical Answer for Your Colleague

### Scenario: Editing Infrastructure Dashboard for a Specific Client

**Use the workspace-specific key from Supabase:**

```typescript
// Fetch the client's API key from Supabase
const { data: client } = await supabase
  .from('client_registry')
  .select('bison_api_key, bison_instance, bison_workspace_id')
  .eq('workspace_name', 'Danny Schwartz')
  .single();

// Use the workspace-specific key
const response = await fetch(
  `${baseUrl}/sender-emails?per_page=100`,
  {
    headers: {
      'Authorization': `Bearer ${client.bison_api_key}`,
      'Accept': 'application/json',
    },
  }
);
```

**Benefits:**
- ✅ No need to create new keys
- ✅ Keys are already validated and working
- ✅ Workspace isolation (can't accidentally access other workspaces)
- ✅ Consistent with webhook implementation

---

### Scenario: Fetching Infrastructure Data for ALL Clients

**Use the super admin keys (current approach):**

```typescript
// For fetching ALL workspaces at once
const emailBisonApiKey = Deno.env.get('EMAIL_BISON_API_KEY');

// Loop through all workspaces
for (const workspace of workspaces) {
  // Switch workspace context
  // Fetch data
}
```

**When this is appropriate:**
- Building aggregate dashboards (like current infrastructure dashboard)
- Bulk operations across all workspaces
- Admin-level reporting

---

## Will Creating New API Keys Cause Issues?

### Short Answer: No, but it's unnecessary

**Creating new workspace-specific API keys will:**
- ✅ Work fine (Email Bison allows multiple keys per workspace)
- ✅ Not interfere with existing keys
- ✅ Not break webhooks (webhooks use their own keys)

**However:**
- ⚠️ Adds unnecessary complexity (you already have 25 keys)
- ⚠️ Need to manage/store the new keys
- ⚠️ Duplicates effort
- ⚠️ Makes key rotation harder (now have 2 sets of keys)

### When You SHOULD Create New Keys:

1. **Key Rotation** - Existing key compromised or expired
2. **Different Permissions** - Need a key with specific rate limits
3. **Testing** - Want a separate key for development/testing
4. **Workspark** - The ONE client without a key yet

---

## Summary & Recommendations

### For Your Colleague:

**Question:** "Can I use the API keys stored in Supabase?"

**Answer:** ✅ **YES - Use the stored workspace-specific API keys**

**How to access them:**
```sql
SELECT
  workspace_name,
  bison_api_key,
  bison_instance,
  bison_workspace_id
FROM client_registry
WHERE workspace_name = 'Client Name Here'
  AND is_active = true;
```

**When NOT to use them:**
- When you need to fetch data from ALL workspaces at once
- When you need to manage workspaces themselves
- When performing super-admin level operations

**In those cases:** Use the super admin keys from environment variables

---

## Quick Reference Table

| Task | Use Workspace Keys? | Use Super Admin Keys? |
|------|---------------------|----------------------|
| Fetch ONE client's email accounts | ✅ Yes | ❌ No |
| Update ONE client's data | ✅ Yes | ❌ No |
| Fetch ALL clients at once | ❌ No | ✅ Yes |
| Create/delete workspaces | ❌ No | ✅ Yes |
| Register webhooks | ✅ Yes | ❌ No |
| Cross-workspace reporting | ❌ No | ✅ Yes |

---

## Where the Keys Are Stored

### Workspace-Specific Keys (25 keys)
**Location:** `client_registry` table
**Column:** `bison_api_key`
**Count:** 25 out of 26 active clients
**Missing:** Workspark (needs key created)

### Super Admin Keys (2 keys)
**Location:** Environment variables (Supabase secrets)
**Variables:**
- `EMAIL_BISON_API_KEY` - Maverick instance
- `LONG_RUN_BISON_API_KEY` - Long Run instance

**Where used:**
- `hybrid-email-accounts-v2` Edge Function
- Infrastructure dashboard data fetching

---

## Code Examples

### Example 1: Using Workspace-Specific Key (Recommended for Single Client)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchClientEmailAccounts(workspaceName: string) {
  // Get the workspace-specific API key
  const { data: client } = await supabase
    .from('client_registry')
    .select('bison_api_key, bison_instance, bison_workspace_id')
    .eq('workspace_name', workspaceName)
    .single();

  if (!client?.bison_api_key) {
    throw new Error(`No API key found for ${workspaceName}`);
  }

  const baseUrl = client.bison_instance === 'Maverick'
    ? 'https://send.maverickmarketingllc.com/api'
    : 'https://send.longrun.agency/api';

  // Fetch sender emails using workspace-specific key
  const response = await fetch(`${baseUrl}/sender-emails?per_page=100`, {
    headers: {
      'Authorization': `Bearer ${client.bison_api_key}`,
      'Accept': 'application/json',
    },
  });

  const data = await response.json();
  return data.data;
}

// Usage
const accounts = await fetchClientEmailAccounts('Danny Schwartz');
```

### Example 2: Using Super Admin Key (For ALL Workspaces)

```typescript
async function fetchAllWorkspacesEmailAccounts() {
  const superAdminKey = Deno.env.get('EMAIL_BISON_API_KEY');
  const baseUrl = 'https://send.maverickmarketingllc.com/api';

  // Fetch all workspaces
  const workspacesResponse = await fetch(`${baseUrl}/workspaces/v1.1`, {
    headers: {
      'Authorization': `Bearer ${superAdminKey}`,
      'Accept': 'application/json',
    },
  });

  const workspaces = await workspacesResponse.json();

  // Loop through each workspace
  const allAccounts = [];
  for (const workspace of workspaces.data) {
    // Switch workspace context
    await fetch(`${baseUrl}/workspaces/v1.1/switch-workspace`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ team_id: workspace.id }),
    });

    // Fetch accounts
    const accountsResponse = await fetch(`${baseUrl}/sender-emails`, {
      headers: {
        'Authorization': `Bearer ${superAdminKey}`,
        'Accept': 'application/json',
      },
    });

    const accounts = await accountsResponse.json();
    allAccounts.push(...accounts.data);
  }

  return allAccounts;
}
```

---

## Final Answer

**Tell your colleague:**

> "Yes, use the workspace-specific API keys stored in Supabase (`client_registry.bison_api_key`). They're already there, working, and are the right choice for workspace-specific operations. You don't need to create new keys unless you're doing something that requires access to ALL workspaces at once (in which case, use the super admin keys from environment variables)."

---

**Document Version:** 1.0
**Last Updated:** October 10, 2025
**Author:** Claude Code Assistant
