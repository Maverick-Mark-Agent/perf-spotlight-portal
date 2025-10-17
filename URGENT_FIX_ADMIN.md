# URGENT: Add Admin Access for Tommy

## Problem
You cannot login because your user (`thomaschavez@maverickmarketingllc.com`) doesn't have admin role in the database.

## Solution
Run this SQL in Supabase Dashboard SQL Editor:
https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new

```sql
INSERT INTO user_workspace_access (user_id, workspace_name, role)
VALUES ('09322929-6078-4b08-bd55-e3e1ff773028', 'admin', 'admin')
ON CONFLICT (user_id, workspace_name) DO NOTHING;
```

## After Running SQL
1. Refresh your browser
2. Try logging in with: `thomaschavez@maverickmarketingllc.com`
3. You should now be redirected to `/admin` dashboard

## Why This Happened
When we set up the authentication system, we created user accounts but didn't assign admin roles in the `user_workspace_access` table. The AuthContext is stuck in loading because it's waiting for the admin check to complete, but there's no admin role to find.
