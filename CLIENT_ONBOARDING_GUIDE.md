# Client Onboarding Guide - Maverick Marketing Portal

This guide explains how to create and manage client accounts for your secure client portal. This is the process you'll follow every time you onboard a new client.

---

## 📋 Quick Reference

**Time per client**: ~5 minutes

**What you'll do**:
1. Create user account in Supabase
2. Assign workspace access
3. Send login credentials to client
4. Verify they can log in

---

## Method 1: Create Client Account (Recommended)

This is the easiest method for non-technical users.

### Step 1: Create the User

1. Go to Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Click **Authentication** → **Users**
4. Click **Add user** → **Create new user**
5. Fill in the form:

```
Email: client@theircompany.com
Password: Generate a secure password (or let client reset it)
Auto Confirm User: ✅ CHECK THIS (skips email verification)
User Metadata: (optional, can leave blank)
```

6. Click **Create user**
7. **IMPORTANT**: Copy the password - you'll need to send it to the client!

### Step 2: Assign Workspace Access

Now link this user to their workspace(s).

1. Go to **SQL Editor** in Supabase
2. Click **+ New query**
3. Paste this SQL (replace the values):

```sql
-- Assign workspace access to the new client user
INSERT INTO public.user_workspace_access (user_id, workspace_name, role)
SELECT
  id as user_id,
  'David Amiri' as workspace_name, -- CHANGE THIS to the client's workspace name
  'client' as role
FROM auth.users
WHERE email = 'client@theircompany.com'; -- CHANGE THIS to the email you just created
```

4. Click **Run**
5. You should see: `Success. Inserted 1 row`

### Step 3: Send Credentials to Client

**Option A: Email Template** (Copy and customize this)

```
Subject: Your Maverick Marketing Client Portal Access

Hi [Client Name],

Your lead tracking portal is now ready! You can access it at:

🔗 Portal URL: https://maverickmarketingllc.com/login

📧 Login Email: client@theircompany.com
🔑 Temporary Password: [paste password here]

IMPORTANT: Please change your password after your first login.

What you can do in the portal:
✅ View all interested leads in real-time
✅ Manage your lead pipeline (drag & drop)
✅ Track won deals and calculate ROI
✅ Refresh data from Email Bison anytime

Questions? Reply to this email or call me at [your phone].

Best regards,
Tommy Chavez
Maverick Marketing LLC
```

**Option B: Slack/Text Message** (For quick sharing)

```
🎉 Your portal is ready!

Login here: https://maverickmarketingllc.com/login
Email: client@theircompany.com
Password: [paste password]

Change your password after first login!
```

### Step 4: Verify Client Access

Ask the client to:
1. Go to the login page
2. Log in with credentials
3. Take a screenshot of their dashboard
4. Reply to confirm it works

**What they should see:**
- Client Portal Hub with their workspace(s)
- Click their workspace → See their leads
- If they see other workspaces or get errors, see Troubleshooting below

---

## Method 2: Create Multiple Clients at Once (Advanced)

If you're onboarding 5+ clients at once, use this bulk method.

### Bulk User Creation SQL

```sql
-- Create multiple users at once
-- NOTE: This requires you to have their email addresses ready

DO $$
DECLARE
  new_user_id UUID;
BEGIN
  -- User 1: John Smith
  INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (
    'john@smithinsurance.com',
    crypt('TempPassword123!', gen_salt('bf')), -- Change password
    NOW(),
    NOW(),
    NOW()
  )
  RETURNING id INTO new_user_id;

  INSERT INTO public.user_workspace_access (user_id, workspace_name, role)
  VALUES (new_user_id, 'John Roberts', 'client'); -- Change workspace name

  -- User 2: Jane Doe
  INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (
    'jane@doeagency.com',
    crypt('TempPassword456!', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW()
  )
  RETURNING id INTO new_user_id;

  INSERT INTO public.user_workspace_access (user_id, workspace_name, role)
  VALUES (new_user_id, 'Shane Miller', 'client');

  -- Add more users here following the same pattern
END $$;
```

**WARNING**: Don't use this unless you're comfortable with SQL!

---

## Giving Access to Multiple Workspaces

Some clients may have access to multiple workspaces (e.g., they own multiple agencies).

### Example: Give "John Smith" access to 3 workspaces

```sql
-- Give john@smithinsurance.com access to 3 different workspaces
INSERT INTO public.user_workspace_access (user_id, workspace_name, role)
SELECT
  id,
  workspace_name,
  'client'
FROM auth.users, UNNEST(ARRAY[
  'John Roberts',
  'Shane Miller',
  'Nick Sakha'
]) AS workspace_name
WHERE email = 'john@smithinsurance.com';
```

After this, John will see all 3 workspaces in his Client Portal Hub.

---

## Managing Client Roles

There are 3 role types you can assign:

### 1. **client** (Default)
- Can view and manage their own leads
- Can update pipeline stages
- Can refresh data from Email Bison
- **Use for**: Regular clients

### 2. **viewer** (Read-only)
- Can only VIEW leads, cannot edit
- Cannot change pipeline stages
- **Use for**: Clients' assistants or bookkeepers

### 3. **admin** (Full access)
- Can see ALL workspaces (not just theirs)
- Can manage other users
- **Use for**: Your team members only

### To change a role:

```sql
UPDATE public.user_workspace_access
SET role = 'viewer' -- Change to 'client', 'viewer', or 'admin'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'client@example.com'
);
```

---

## Removing Client Access

### Soft Delete: Remove workspace access but keep user

```sql
-- Remove access to specific workspace
DELETE FROM public.user_workspace_access
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'client@example.com'
)
AND workspace_name = 'David Amiri';
```

After this, the user can still log in but won't see that workspace.

### Hard Delete: Delete user completely

1. Go to Supabase → **Authentication** → **Users**
2. Find the user
3. Click **⋮** (three dots) → **Delete user**
4. Confirm deletion

This will automatically delete their workspace access too (due to CASCADE in database).

---

## Password Resets

### Client forgot password:

**Option 1: They can do it themselves**
1. Go to login page
2. Click "Forgot password?"
3. Enter email
4. Check email for reset link

**Option 2: You reset it for them**

1. Supabase → **Authentication** → **Users**
2. Find the user
3. Click **⋮** → **Send password reset email**
4. They'll get an email with reset link

**Option 3: You manually change their password**

```sql
-- Set a new password for a user
UPDATE auth.users
SET encrypted_password = crypt('NewPassword123!', gen_salt('bf'))
WHERE email = 'client@example.com';
```

---

## Checking Client Login Activity

### See who logged in recently:

1. Supabase → **Authentication** → **Users**
2. Look at **Last Sign In** column
3. Sort by **Last Sign In** to see most recent

### Check specific user's login history:

```sql
SELECT
  email,
  created_at as account_created,
  last_sign_in_at,
  email_confirmed_at
FROM auth.users
WHERE email = 'client@example.com';
```

---

## Common Onboarding Scenarios

### Scenario 1: Client with One Workspace

**Example**: David Amiri Insurance

```sql
-- Create user
-- (Do this in Supabase UI: Authentication → Users → Add user)
-- Email: david@amiriinsurance.com
-- Password: GenerateSecure123!

-- Assign workspace
INSERT INTO public.user_workspace_access (user_id, workspace_name, role)
SELECT id, 'David Amiri', 'client'
FROM auth.users
WHERE email = 'david@amiriinsurance.com';
```

### Scenario 2: Client with Multiple Workspaces

**Example**: Jason runs 3 different brands

```sql
-- Assign all 3 workspaces at once
INSERT INTO public.user_workspace_access (user_id, workspace_name, role)
SELECT
  id,
  workspace_name,
  'client'
FROM auth.users,
UNNEST(ARRAY[
  'Jason Binyon',
  'StreetSmart P&C',
  'StreetSmart Trucking'
]) AS workspace_name
WHERE email = 'jason@binyon.com';
```

### Scenario 3: Adding a Viewer (Assistant)

**Example**: David's assistant needs read-only access

```sql
-- Create user for assistant
-- (Do in UI: Authentication → Users → Add user)
-- Email: assistant@amiriinsurance.com

-- Give viewer access
INSERT INTO public.user_workspace_access (user_id, workspace_name, role)
SELECT id, 'David Amiri', 'viewer'
FROM auth.users
WHERE email = 'assistant@amiriinsurance.com';
```

### Scenario 4: Adding Your Team Member

**Example**: Your VA needs access to help clients

```sql
-- Create team member account
-- (Do in UI: Authentication → Users → Add user)
-- Email: va@maverickmarketingllc.com

-- Give admin access (sees all workspaces)
INSERT INTO public.user_workspace_access (user_id, workspace_name, role)
SELECT id, 'ALL_WORKSPACES', 'admin'
FROM auth.users
WHERE email = 'va@maverickmarketingllc.com';
```

---

## Workspace Name Reference

Here are your current active workspace names (must match exactly):

```
- ATI
- Danny Schwartz
- David Amiri
- Devin Hodo
- Gregg Blanchard
- Insurance
- Jason Binyon
- Jeff Schroder
- John Roberts
- Kim Wallace
- Kirk Hodgson
- Nick Sakha
- Rob Russell
- Shane Miller
- SMA Insurance
- StreetSmart Commercial
- StreetSmart P&C
- StreetSmart Trucking
- Tony Schmitz
```

**Important**: Names are case-sensitive! `David Amiri` ≠ `david amiri`

To get latest workspace list:

```sql
SELECT DISTINCT workspace_name
FROM client_leads
ORDER BY workspace_name;
```

---

## Troubleshooting

### Problem: Client says "No workspaces found"

**Check 1**: Did you assign workspace access?
```sql
SELECT * FROM user_workspace_access
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'client@example.com');
```

If empty, assign access using the SQL from Step 2.

**Check 2**: Does workspace name match exactly?
```sql
-- See what you assigned
SELECT workspace_name FROM user_workspace_access
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'client@example.com');

-- Compare to actual workspace names
SELECT DISTINCT workspace_name FROM client_leads ORDER BY workspace_name;
```

### Problem: Client sees other clients' workspaces

**This should NEVER happen!** If it does:

1. Check RLS policies are enabled:
```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename = 'client_leads';
```

2. Verify they don't have 'admin' role:
```sql
SELECT role FROM user_workspace_access
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'client@example.com');
```

If role is 'admin', change it:
```sql
UPDATE user_workspace_access
SET role = 'client'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'client@example.com');
```

### Problem: "Invalid login credentials"

**Solution**: Reset their password
1. Supabase → Authentication → Users
2. Find user → ⋮ → Send password reset email

OR set a new password directly:
```sql
UPDATE auth.users
SET encrypted_password = crypt('NewPassword123!', gen_salt('bf'))
WHERE email = 'client@example.com';
```

---

## Best Practices

### ✅ DO:
- Use strong passwords (12+ characters, mix of letters/numbers/symbols)
- Check that workspace names match exactly
- Send welcome email with clear instructions
- Verify client can log in before considering onboarding complete
- Document which workspaces belong to which clients

### ❌ DON'T:
- Give 'admin' role to clients (only your team)
- Share credentials via unsecured channels (no plain text SMS)
- Forget to check "Auto Confirm User" when creating accounts
- Leave default passwords indefinitely - encourage clients to change them

---

## Email Templates

### Welcome Email (New Client)

```
Subject: Welcome to Maverick Marketing - Your Portal is Ready! 🎉

Hi [Client Name],

I'm excited to share that your personalized lead tracking portal is now active!

🔗 Login here: https://maverickmarketingllc.com/login

Your credentials:
📧 Email: [client email]
🔑 Password: [password]

Please change your password after logging in by clicking "Forgot password?" on the login page.

What you'll see in your portal:
✅ All interested leads in real-time
✅ Pipeline management (drag leads between stages)
✅ Won deal tracking
✅ Campaign performance metrics

Need help? I'm here:
📞 [Your Phone]
📧 support@maverickmarketingllc.com

Let's close some deals!

Tommy Chavez
Maverick Marketing LLC
```

### Password Reset Email

```
Subject: Password Reset - Maverick Marketing Portal

Hi [Client Name],

I've reset your portal password. Here are your new credentials:

🔗 Login: https://maverickmarketingllc.com/login
📧 Email: [client email]
🔑 New Password: [password]

For security, please change this password after logging in.

Best,
Tommy
```

---

**You're all set!** Follow this guide every time you onboard a new client.

Need help? Email: support@maverickmarketingllc.com
