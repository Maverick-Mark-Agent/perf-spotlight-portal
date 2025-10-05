# Email Bison API Reference
Complete API documentation for Email Bison email outreach platform.
## Overview
**Base URL:** `https://send.maverickmarketingllc.com`
**Authentication:** Bearer Token
You can retrieve your token by visiting your dashboard and clicking **Generate API token**.

**Total Endpoints:** 122
**API Version:** 1.0.0

## Table of Contents
1. [Account Management](#account-management)
2. [Campaigns](#campaigns)
3. [Replies](#replies)
4. [Email Accounts](#email-accounts)
5. [Email Blacklist](#email-blacklist)
6. [Domain Blacklist](#domain-blacklist)
7. [Custom Tags](#custom-tags)
8. [Custom Tracking Domains](#custom-tracking-domains)
9. [Webhooks](#webhooks)
10. [Campaign Events](#campaign-events)
11. [Campaigns v1.1](#campaigns-v1.1)
12. [Custom Lead Variables](#custom-lead-variables)
13. [Ignore Phrases](#ignore-phrases)
14. [Leads](#leads)
15. [Warmup](#warmup)
16. [Webhook Events](#webhook-events)
17. [Workspaces v1 (deprecated)](#workspaces-v1-deprecated)
18. [Workspaces v1.1](#workspaces-v1.1)

---
## Critical Endpoints
These are the most commonly used endpoints in our application:

### POST `/api/workspaces/v1.1/switch-workspace`
Switch active workspace context

**Description:** This endpoint allows the authenticated user to switch to a different workspace.

The user must provide a valid authentication token in the request header
and the ID of the target workspace in the request body to access this endpoint.

### GET `/api/workspaces/v1.1`
List all workspaces

**Description:** This endpoint retrieves all of the authenticated user's workspaces.

The user must provide a valid authentication token in the request header to access this endpoint.

### GET `/api/replies`
Fetch email replies

**Description:** This endpoint retrieves all replies for the authenticated user.

The user must provide a valid authentication token in the request header to access this endpoint.

### GET `/api/workspaces/v1.1/stats`
Get workspace statistics

**Description:** This endpoint retrieves overall stats for this workspace between two given dates.

The user must provide a valid authentication token in the request header to access this endpoint.

### POST `/api/webhooks`
Create webhook subscription

### GET `/api/leads`
List campaign leads

**Description:** Retrieve a list of all leads for the authenticated user.


---
## Code Examples
### Authentication
```javascript
const API_TOKEN = 'your_api_token_here';
const BASE_URL = 'https://send.maverickmarketingllc.com';

const headers = {
  'Authorization': `Bearer ${API_TOKEN}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};
```

### Switch Workspace
```javascript
const switchWorkspace = async (workspaceId) => {
  const response = await fetch(`${BASE_URL}/api/workspaces/v1.1/switch-workspace`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ workspace_id: workspaceId })
  });
  return await response.json();
};
```

### Fetch Interested Replies
```javascript
const getInterestedReplies = async () => {
  const response = await fetch(`${BASE_URL}/api/replies?interested=true`, {
    method: 'GET',
    headers
  });
  return await response.json();
};
```

### Get Workspace Statistics
```javascript
const getWorkspaceStats = async () => {
  const response = await fetch(`${BASE_URL}/api/workspaces/v1.1/stats`, {
    method: 'GET',
    headers
  });
  return await response.json();
};
```


---
## API Reference by Category

### Account Management
This section handles operations related to user accounts within the application. It includes endpoints for user registration, profile management and password reset.

#### GET `/api/users`
**Account Details**

This endpoint retrieves the details of the authenticated user. The user must provide a valid authentication token in the request header to access this endpoint.

**Success Response (200):**

---

#### POST `/api/users/profile-picture`
**Update Profile Picture**

This endpoint allows the authenticated user to update their profile information, specifically their profile picture. The user must provide a valid authentication token in the request header to access this endpoint.

**Request Body:** (required)

*Content-Type:* `multipart/form-data`

```json
{
  "photo": "" // required
}
```

**Success Response (200):**

---

#### PUT `/api/users/password`
**Update Password**

This endpoint allows the authenticated user to update their password. The user must provide a valid authentication token in the request header to access this endpoint.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "current_password": "password", // required
  "password": "new-password", // required
  "password_confirmation": "new-password" // required
}
```

**Success Response (200):**

---

#### POST `/api/users/headless-ui-token`
**Generate headless UI token (beta)**

This endpoint allows the authenticated workspace user to generate a headless UI token that's valid for up to **120 minutes**. The main purpose of this token is to let partner apps generate an embedded email account connection view without having to build all the UIs and OAuth connection flows themselves. Multiple tokens can be active at a given time, but they will all expire after **120 minutes**. `Note:` You must get your requesting URL whitelisted before embedding the iframe in your app. The user must provide a valid authentication token in the request header to access this endpoint. Once a token is generated, you can open an Iframe with the following URL format: https://your-bison-url.com/headless-ui-login?token=YOUR_HEADLESS_UI_TOKEN This will then open an app window without the navigation bar and breadcrumbs. For now, this is only recommended for enabling email account connection flows for OAuth.

**Success Response (200):**

---

### Campaigns
This section provides endpoints to manage campaign-related operations.

#### GET `/api/campaigns`
**List campaigns**

This endpoint retrieves all of the authenticated user's campaigns. Search, tags, and status are all optional parameters.

**Request Body:** (optional)

*Content-Type:* `application/json`

```json
{
  "search": null, // optional
  "status": "active", // optional
  "tag_ids": [6] // optional
}
```

**Success Response (200):**

---

#### POST `/api/campaigns`
**Create a campaign**

This endpoint allows the authenticated user to create a new campaign.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "name": "New Campaign", // required
  "type": "outbound" // optional
}
```

**Success Response (200):**

---

#### POST `/api/campaigns/{campaign_id}/duplicate`
**Duplicate campaign**

This endpoint allows the authenticated user to duplicate a campaign.

**Success Response (200):**

---

#### PATCH `/api/campaigns/{campaign_id}/pause`
**Pause campaign**

This endpoint allows the authenticated user to pause a campaign.

**Success Response (200):**

---

#### PATCH `/api/campaigns/{campaign_id}/resume`
**Resume campaign**

This endpoint allows the authenticated user to resume a paused campaign.

**Success Response (200):**

---

#### PATCH `/api/campaigns/{campaign_id}/archive`
**Archive campaign**

This endpoint allows the authenticated user to archive a campaign.

**Success Response (200):**

---

#### PATCH `/api/campaigns/{id}/update`
**Update campaign settings**

This endpoint allows the authenticated user to update the settings of a campaign.

**Request Body:** (optional)

*Content-Type:* `application/json`

```json
{
  "name": "New Campaign Name", // optional
  "max_emails_per_day": 500, // optional
  "max_new_leads_per_day": 100, // optional
  "plain_text": true, // optional
  "open_tracking": true, // optional
  "reputation_building": true, // optional
  "can_unsubscribe": true, // optional
  "unsubscribe_text": "Click here to unsubscribe" // optional
}
```

**Success Response (200):**

---

#### POST `/api/campaigns/{campaign_id}/schedule`
**Create campaign schedule**

This endpoint allows the authenticated user to create the schedule of the campaign.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "monday": true, // required
  "tuesday": true, // required
  "wednesday": true, // required
  "thursday": true, // required
  "friday": true, // required
  "saturday": false, // required
  "sunday": false, // required
  "start_time": "09:00", // required
  "end_time": "17:00", // required
  "timezone": "America/New_York", // required
  "save_as_template": false // optional
}
```

**Success Response (200):**

---

#### GET `/api/campaigns/{campaign_id}/schedule`
**View campaign schedule**

This endpoint allows the authenticated user to view the schedule of the campaign.

**Success Response (200):**

---

#### PUT `/api/campaigns/{campaign_id}/schedule`
**Update campaign schedule**

This endpoint allows the authenticated user to update the schedule of the campaign.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "monday": true, // required
  "tuesday": true, // required
  "wednesday": true, // required
  "thursday": true, // required
  "friday": true, // required
  "saturday": false, // required
  "sunday": false, // required
  "start_time": "09:00", // required
  "end_time": "17:00", // required
  "timezone": "America/New_York", // required
  "save_as_template": true // required
}
```

**Success Response (200):**

---

#### GET `/api/campaigns/schedule/templates`
**View all schedule templates**

This endpoint allows the authenticated user to view their scheduled templates.

**Success Response (200):**

---

#### GET `/api/campaigns/schedule/available-timezones`
**View all available schedule timezones**

This endpoint allows the authenticated user to view all available timezones. You must use an ID from this list whenever you're working on Campaign Schedules

**Success Response (200):**

---

#### GET `/api/campaigns/sending-schedules`
**Show sending schedules for campaigns**

This endpoint allows the authenticated user to view the sending schedules for campaigns

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "day": "tomorrow" // required
}
```

**Success Response (200):**

---

#### GET `/api/campaigns/{campaign_id}/sending-schedule`
**Show sending schedule for campaign**

This endpoint allows the authenticated user to view the sending schedule of a single campaign

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "day": "tomorrow" // required
}
```

**Success Response (200):**

---

#### POST `/api/campaigns/{campaign_id}/create-schedule-from-template`
**Create campaign schedule from template**

This endpoint allows the authenticated user to create the schedule of the campaign.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "schedule_id": 1 // required
}
```

**Success Response (200):**

---

#### GET `/api/campaigns/{campaign_id}/sequence-steps`
**View campaign sequence steps (deprecated)**

This endpoint allows the authenticated user to view the sequence steps of the campaign.

**Success Response (200):**

---

#### POST `/api/campaigns/{campaign_id}/sequence-steps`
**Create sequence steps (deprecated)**

This endpoint allows the authenticated user to create the campaign sequence steps from scratch.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "title": "John Doe sequence", // required
  "sequence_steps": [{"email_subject": "Hello there!", "email_subject_variables": ["{FIRST_NAME}"], "order": 1, "email_body": "Try it now!", "wait_in_days": 1, "variant": false, "thread_reply": false}, {"email_subject": "Reaching you again", "order": 2, "email_body": "Try it now!", "wait_in_days": 1, "variant": true, "variant_from_step": 1, "thread_reply": true}] // required
}
```

**Success Response (200):**

---

#### PUT `/api/campaigns/sequence-steps/{sequence_id}`
**Update sequence steps (deprecated)**

This endpoint allows the authenticated user to update the campaign sequence steps.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "title": "John Doe sequence", // required
  "sequence_steps": [{"id": 1, "email_subject": "Hello there!", "email_subject_variables": ["{FIRST_NAME}"], "order": 1, "email_body": "Try it now!", "wait_in_days": 1, "variant": false, "thread_reply": false}, {"id": 2, "email_subject": "Hello again!", "order": 2, "email_body": "Try it now!", "wait_in_days": 1, "variant": true, "variant_from_step": 1, "thread_reply": true}] // required
}
```

**Success Response (200):**

---

#### DELETE `/api/campaigns/sequence-steps/{sequence_step_id}`
**Delete sequence step**

This endpoint allows the authenticated user to delete a specific sequence step from a sequence

**Success Response (200):**

---

#### POST `/api/campaigns/sequence-steps/{sequence_step_id}/test-email`
**Send sequence step test email**

This endpoint allows the authenticated user to send a test email from a sequence step. You need at least one lead in the campaign to send a test email.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "sender_email_id": 6, // required
  "to_email": "breitenberg.colten@example.net", // required
  "use_dedicated_ips": true // optional
}
```

**Success Response (200):**

---

#### GET `/api/campaigns/{campaign_id}/replies`
**Get campaign replies**

This endpoint retrieves all replies associated with a campaign.

**Query Parameters:**
- `search` (['string', 'null']) (optional): Search term for filtering replies.
- `status` (string) (optional): Filter by status. One of `interested`, `automated_reply`, `not_automated_reply`.
- `folder` (string) (optional): Filter by folder. One of `inbox`, `sent`, `spam`, `bounced`, `all`.
- `read` (['boolean', 'null']) (optional): Filter by read status.
- `sender_email_id` (integer) (optional): The ID of the sender email address.
- `lead_id` (integer) (optional): The <code>id</code> of an existing record in the leads table.
- `tag_ids` (array) (optional): Array of tag IDs to filter by.
- `campaign_id` (integer) (optional): The ID of the campaign.

**Success Response (200):**

---

#### GET `/api/campaigns/{campaign_id}/leads`
**Get all leads for campaign**

This endpoint retrieves all leads associated with a campaign.

**Query Parameters:**
- `search` (['string', 'null']) (optional): Search term for filtering replies.
- `filters` (object) (optional): 
- `filters.lead_campaign_status` (string) (optional): Filter by lead campaign status. One of `in_sequence`, `sequence_finished`, `sequence_stopped`, `never_contacted`, `replied`.
- `filters.emails_sent` (array) (optional): Filter by the number of emails sent.
- `filters.emails_sent.criteria` (string) (optional): Comparison operator for emails sent. One of `=`, `>=`, `>`, `<=`, `<`.
- `filters.emails_sent.value` (['integer', 'null']) (optional): Value for the number of emails sent.
- `filters.opens` (object) (optional): 
- `filters.opens.criteria` (string) (optional): Comparison operator for email opens. One of `=`, `>=`, `>`, `<=`, `<`.
- `filters.opens.value` (['integer', 'null']) (optional): Value for the number of email opens.
- `filters.replies` (object) (optional): 
- `filters.replies.criteria` (string) (optional): Comparison operator for replies. One of `=`, `>=`, `>`, `<=`, `<`.
- `filters.replies.value` (['integer', 'null']) (optional): Value for the number of replies.
- `filters.verification_statuses` (array) (optional): A verification status. Accepted values: `verifying`, `verified`, `risky`, `unknown`, `unverified`, `inactive`, `bounced`, `unsubscribed`
- `filters.tag_ids` (array) (optional): Filter by tag IDs.
- `filters.excluded_tag_ids` (array) (optional): Exclude leads by tag IDs.
- `filters.without_tags` (boolean) (optional): Only show leads that have no tags attached.
- `filters.created_at.criteria` (string) (optional): Comparison operator for the created_at date. One of `=`, `>=`, `>`, `<=`, `<`.
- `filters.created_at.value` (string) (optional): Value for the created_at date. Must be a valid date in YYYY-MM-DD format.
- `filters.updated_at.criteria` (string) (optional): Comparison operator for the updated_at date. One of `=`, `>=`, `>`, `<=`, `<`.
- `filters.updated_at.value` (string) (optional): Value for the updated_at date. Must be a valid date in YYYY-MM-DD format.

**Success Response (200):**

---

#### DELETE `/api/campaigns/{campaign_id}/leads`
**Remove leads from campaign**

This endpoint allows the authenticated user to remove leads from a campaign.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "lead_ids": [1, 2, 3] // required
}
```

**Success Response (200):**

---

#### POST `/api/campaigns/{campaign_id}/leads/attach-lead-list`
**Import leads from existing list**

This endpoint allows the authenticated user to import leads from an existing list into a campaign.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "allow_parallel_sending": false, // optional
  "lead_list_id": 1 // required
}
```

**Success Response (200):**

---

#### POST `/api/campaigns/{campaign_id}/leads/attach-leads`
**Import leads by IDs**

This endpoint allows the authenticated user to import leads by their IDs into a campaign. If you are adding leads to an active campaign, we cache them locally, and then sync every 5 minutes to ensure there is no interruption to your sending. **Important:** If you add leads into a "reply followup campaign" using this endpoint, we will just start the conversation from **the last sent reply**. We recommend that you use the more explicit `/replies/id/followup-campaign/push` endpoint to control exactly which conversation you want to follow up on.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "allow_parallel_sending": false, // optional
  "lead_ids": [1, 2, 3] // required
}
```

**Success Response (200):**

---

#### POST `/api/campaigns/{campaign_id}/leads/stop-future-emails`
**Stop future emails for leads**

This endpoint allows the authenticated user to stop future emails for selected leads in a campaign

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "lead_ids": [1, 2, 3] // required
}
```

**Success Response (200):**

---

#### GET `/api/campaigns/{campaign_id}/scheduled-emails`
**Get all scheduled emails for campaign**

This endpoint retrieves all scheduled emails associated with a campaign.

**Request Body:** (optional)

*Content-Type:* `application/json`

```json
{
  "status": "paused", // optional
  "scheduled_date": "2025-09-28T21:58:06", // optional
  "scheduled_date_local": "2025-09-28T21:58:06" // optional
}
```

**Success Response (200):**

---

#### GET `/api/campaigns/{campaign_id}/sender-emails`
**Get all campaign sender emails**

This endpoint retrieves all email accounts (sender emails) associated with a campaign

**Success Response (200):**

---

#### POST `/api/campaigns/{campaign_id}/stats`
**Get campaign stats (summary)**

This endpoint retrieves the statistics of all your campaigns.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "start_date": "2024-07-01", // required
  "end_date": "2024-07-19" // required
}
```

**Success Response (200):**

---

#### POST `/api/campaigns/{campaign_id}/attach-sender-emails`
**Import sender emails by ID**

This endpoint allows the authenticated user to attach sender emails to a campaign.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "sender_email_ids": [1, 2, 3] // required
}
```

**Success Response (200):**

---

#### DELETE `/api/campaigns/{campaign_id}/remove-sender-emails`
**Remove sender emails by ID**

This endpoint allows the authenticated user to remove sender emails from a draft or paused campaign.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "sender_email_ids": [1, 2, 3] // required
}
```

**Success Response (200):**

---

#### GET `/api/campaigns/{campaign_id}/line-area-chart-stats`
**Get full normalized stats by date**

This endpoint retrieves stats by date for a given period, for this campaign The user must provide a valid authentication token in the request header to access this endpoint. Events returned: `Replied`, `Total Opens`, `Unique Opens`, `Sent`, `Bounced`, `Unsubscribed`, `Interested`

**Query Parameters:**
- `start_date` (string) (required): The start date to fetch stats.
- `end_date` (string) (required): The end date to fetch stats.

**Success Response (200):**

---

#### GET `/api/campaigns/{id}`
**Campaign details**

This endpoint retrieves the details of a specific campaign.

**Success Response (200):**

---

### Replies
This section provides endpoints to manage replies. It includes functionalities for retrieving, updating, and managing replies.

#### GET `/api/replies`
**Get all replies**

This endpoint retrieves all replies for the authenticated user. The user must provide a valid authentication token in the request header to access this endpoint.

**Query Parameters:**
- `search` (['string', 'null']) (optional): Search term for filtering replies.
- `status` (string) (optional): Filter by status. One of `interested`, `automated_reply`, `not_automated_reply`.
- `folder` (string) (optional): Filter by folder. One of `inbox`, `sent`, `spam`, `bounced`, `all`.
- `read` (['boolean', 'null']) (optional): Filter by read status.
- `campaign_id` (integer) (optional): The ID of the campaign.
- `sender_email_id` (integer) (optional): The ID of the sender email address.
- `lead_id` (integer) (optional): The <code>id</code> of an existing record in the leads table.
- `tag_ids` (array) (optional): Array of tag IDs to filter by.

**Success Response (200):**

---

#### GET `/api/replies/{id}`
**Get reply**

This endpoint retrieves a specific reply by its ID. The user must provide a valid authentication token in the request header to access this endpoint.

**Success Response (200):**

---

#### POST `/api/replies/new`
**Compose new email**

This endpoint allows you to send a one-off email in a new email thread The user must provide a valid authentication token in the request header to access this endpoint. Please note that if you are sending an array of file attachments, your request must include a header of "Content-Type": "multipart/form-data". Otherwise your file attachments will not be processed.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "subject": "Quick question", // optional
  "message": "How are you doing?", // optional
  "sender_email_id": 13, // required
  "use_dedicated_ips": true, // optional
  "content_type": "html", // optional
  "to_emails": [{"name": "John Doe", "email_address": "john@example.com"}], // optional
  "cc_emails": null, // optional
  "bcc_emails": null, // optional
  "attachments": null // optional
}
```

**Success Response (200):**

---

#### POST `/api/replies/{reply_id}/reply`
**Create new reply**

This endpoint allows you to reply to an existing email The user must provide a valid authentication token in the request header to access this endpoint. Please note that if you are sending an array of file attachments, your request must include a header of "Content-Type": "multipart/form-data". Otherwise your file attachments will not be processed.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "inject_previous_email_body": true, // optional
  "message": "How are you doing?", // optional
  "use_dedicated_ips": true, // optional
  "sender_email_id": 1, // required
  "content_type": "html", // optional
  "to_emails": [{"name": "John Doe", "email_address": "john@example.com"}], // required
  "cc_emails": [{"name": "John Doe", "email_address": "john@example.com"}], // optional
  "bcc_emails": [{"name": "Jane Doe", "email_address": "jane@example.com"}], // optional
  "attachments": null // optional
}
```

**Success Response (200):**

---

#### POST `/api/replies/{reply_id}/forward`
**Forward reply**

This endpoint allows you to forward an existing reply. The user must provide a valid authentication token in the request header to access this endpoint. Please note that if you are sending an array of file attachments, your request must include a header of "Content-Type": "multipart/form-data". Otherwise your file attachments will not be processed.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "inject_previous_email_body": true, // optional
  "message": "How are you doing?", // optional
  "use_dedicated_ips": true, // optional
  "sender_email_id": 3, // required
  "content_type": "html", // optional
  "to_emails": [{"name": "John Doe", "email_address": "john@example.com"}], // optional
  "cc_emails": null, // optional
  "bcc_emails": null, // optional
  "attachments": null // optional
}
```

**Success Response (200):**

---

#### PATCH `/api/replies/{reply_id}/mark-as-interested`
**Mark as interested**

This endpoint marks a specific reply as interested. If a particular lead is already marked as "interested" within a campaign, no changes will be made. The user must provide a valid authentication token in the request header to access this endpoint.

**Request Body:** (optional)

*Content-Type:* `application/json`

```json
{
  "skip_webhooks": false // optional
}
```

**Success Response (200):**

---

#### PATCH `/api/replies/{reply_id}/mark-as-not-interested`
**Mark as not interested**

This endpoint marks a specific reply as not interested. The user must provide a valid authentication token in the request header to access this endpoint.

**Request Body:** (optional)

*Content-Type:* `application/json`

```json
{
  "skip_webhooks": false // optional
}
```

**Success Response (200):**

---

#### PATCH `/api/replies/{reply_id}/mark-as-read-or-unread`
**Mark as read or unread**

This endpoint marks a specific reply as read or unread. The user must provide a valid authentication token in the request header to access this endpoint.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "read": false // required
}
```

**Success Response (200):**

---

#### PATCH `/api/replies/{reply_id}/mark-as-automated-or-not-automated`
**Mark as automated or not automated**

This endpoint marks a specific reply as automated or not automated. The user must provide a valid authentication token in the request header to access this endpoint.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "automated": true // required
}
```

**Success Response (200):**

---

#### PATCH `/api/replies/{reply_id}/unsubscribe`
**Unsubscribe contact that replied**

This endpoint unsubscribes the contact associated with a specific reply from scheduled emails. The user must provide a valid authentication token in the request header to access this endpoint.

**Success Response (200):**

---

#### DELETE `/api/replies/{reply_id}`
**Delete reply**

This endpoint deletes a specific reply by its ID. The user must provide a valid authentication token in the request header to access this endpoint.

**Success Response (200):**

---

#### GET `/api/replies/{reply_id}/conversation-thread`
**Get reply conversation thread**

This endpoint gets you a reply object with all previous and newer messages to build out an email thread The user must provide a valid authentication token in the request header to access this endpoint.

**Success Response (200):**

---

#### POST `/api/replies/{reply_id}/attach-scheduled-email-to-reply`
**Attach scheduled email to reply**

This endpoint attaches a scheduled email to a reply (and lead). You can use this for untracked replies where headers may have been missing when the email was received. This will take care of incrementing all stats too.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "scheduled_email_id": 18 // required
}
```

**Success Response (200):**

---

#### POST `/api/replies/{reply_id}/followup-campaign/push`
**Push reply (and lead) to "reply followup campaign"**

This endpoint lets you push a reply to a "reply followup campaign" The goal is to followup with interested leads in a templated, automated manner. Followups are done in the same conversation thread, and we take the last message from the conversation to continue the process. Caveats: the reply must have a sender email attached. If you deleted a sender email, then you will need to add this lead into a separate outbound campaign since we cannot send an email in the same thread.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "campaign_id": 16, // required
  "force_add_reply": false // optional
}
```

**Success Response (200):**

---

### Email Accounts
This section provides endpoints to manage email accounts associated with a workspace. It includes functionalities for listing all email accounts, retrieving details of a specific email account, creating new IMAP/SMTP email accounts, testing IMAP and SMTP connections, and deleting existing email accounts.

#### GET `/api/sender-emails`
**List email accounts**

Retrieves a collection of email accounts associated with the authenticated workspace.

**Query Parameters:**
- `search` (['string', 'null']) (optional): Search term for filtering replies.
- `tag_ids` (array) (optional): Array of tag IDs to filter by.
- `excluded_tag_ids` (array) (optional): The <code>id</code> of an existing record in the tags table.
- `without_tags` (boolean) (optional): 
- `filters.excluded_tag_ids` (array) (optional): Exclude email accounts by tag IDs.
- `filters.without_tags` (boolean) (optional): Only show email accounts that have no tags attached.

**Success Response (200):**

---

#### GET `/api/sender-emails/{senderEmailId}/campaigns`
**Show Email Account Campaigns**

Retrieves a collection of campaigns where this email account is being used

**Success Response (200):**

---

#### GET `/api/sender-emails/{senderEmailId}`
**Show email account details**

Retrieves details of a specific email account.

**Success Response (200):**

---

#### PATCH `/api/sender-emails/{senderEmailId}`
**Update sender email**

Update the settings for a specified sender email.

**Request Body:** (optional)

*Content-Type:* `application/json`

```json
{
  "daily_limit": 300, // optional
  "name": "John Doe", // optional
  "email_signature": "<p><strong>{SENDER_FIRST_NAME}</strong> | Consultant</p>" // optional
}
```

**Success Response (200):**

---

#### DELETE `/api/sender-emails/{senderEmailId}`
**Delete email account**

Add multiple sender email addresses at once.

**Success Response (200):**

---

#### GET `/api/sender-emails/{senderEmailId}/replies`
**Get email account replies**

This endpoint retrieves all replies associated with a given email account

**Query Parameters:**
- `search` (['string', 'null']) (optional): Search term for filtering replies.
- `status` (string) (optional): Filter by status. One of `interested`, `automated_reply`, `not_automated_reply`.
- `folder` (string) (optional): Filter by folder. One of `inbox`, `sent`, `spam`, `bounced`, `all`.
- `read` (['boolean', 'null']) (optional): Filter by read status.
- `campaign_id` (integer) (optional): The ID of the campaign.
- `lead_id` (integer) (optional): The <code>id</code> of an existing record in the leads table.
- `tag_ids` (array) (optional): Array of tag IDs to filter by.
- `sender_email_id` (integer) (optional): The ID of the sender email address.

**Success Response (200):**

---

#### GET `/api/sender-emails/{senderEmailId}/oauth-access-token`
**Get email account oAuth access token**

This endpoint retrieves the OAuth access token for a sender email account (Google or Microsoft accounts only). If a token has expired, a new one is automatically retrieved and returned using the saved refresh token.

**Success Response (200):**

---

#### PATCH `/api/sender-emails/signatures/bulk`
**Bulk update email signatures**

Update the signatures of multiple sender emails at once.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "sender_email_ids": [1, 2], // required
  "email_signature": "<p><strong>{SENDER_FIRST_NAME}</strong> | Consultant</p>" // required
}
```

**Success Response (200):**

---

#### PATCH `/api/sender-emails/daily-limits/bulk`
**Bulk update email daily limits**

Update the daily sending limit of multiple sender emails at once.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "sender_email_ids": [1, 2], // required
  "daily_limit": 9 // required
}
```

**Success Response (200):**

---

#### POST `/api/sender-emails/imap-smtp`
**Create IMAP/SMTP Email Account**

Creates a new IMAP/SMTP email account for the authenticated workspace.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "name": "John Doe", // required
  "email": "john.doe@example.com", // required
  "password": "securepassword123", // required
  "imap_server": "imap.example.com", // required
  "imap_port": 993, // required
  "smtp_server": "smtp.example.com", // required
  "smtp_port": 587, // required
  "smtp_secure": false, // optional
  "imap_secure": true, // optional
  "email_signature": "{SENDER_FIRST_NAME} | Consultant" // optional
}
```

**Success Response (200):**

---

#### POST `/api/sender-emails/bulk`
**Bulk add sender emails**

Add multiple sender email addresses at once.

**Request Body:** (required)

*Content-Type:* `multipart/form-data`

```json
{
  "csv": "" // required
}
```

---

#### POST `/api/sender-emails/{senderEmailId}/check-mx-records`
**Check MX records**

Checks the email host for a given email address and returns the host + all MX records. Results are not cached, and if a valid return is returned, the Sender Email account will be updated.

**Success Response (200):**

---

#### POST `/api/sender-emails/bulk-check-missing-mx-records`
**Bulk check missing MX records**

This endpoint lets you trigger a job that will bulk check all email accounts with missing MX records in the given workspace.

**Success Response (200):**

---

### Email Blacklist
APIs for managing blacklisted emails. This includes retrieving, creating, bulk creating, and removing blacklisted emails.

#### GET `/api/blacklisted-emails`
**Get all blacklisted emails**

Retrieve a list of all blacklisted emails for the authenticated user.

**Success Response (200):**

---

#### POST `/api/blacklisted-emails`
**Create blacklisted email**

Add a new email to the blacklist.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "email": "john@doe.com" // required
}
```

---

#### POST `/api/blacklisted-emails/bulk`
**Bulk create blacklisted emails**

Add multiple emails to the blacklist in a single request.

**Request Body:** (required)

*Content-Type:* `multipart/form-data`

```json
{
  "csv": "" // required
}
```

---

#### DELETE `/api/blacklisted-emails/{blacklisted_email_id}`
**Remove blacklisted email**

Remove an email from the blacklist.

---

### Domain Blacklist
APIs for managing blacklisted domains. This includes retrieving, creating, bulk creating, and removing blacklisted domains.

#### GET `/api/blacklisted-domains`
**Get all blacklisted domains**

Retrieve a list of all blacklisted domains for the authenticated user.

**Success Response (200):**

---

#### POST `/api/blacklisted-domains`
**Create blacklisted domain**

Add a new domain to the blacklist.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "domain": "example.com" // required
}
```

---

#### POST `/api/blacklisted-domains/bulk`
**Bulk create blacklisted domains**

Add multiple domains to the blacklist in a single request.

**Request Body:** (required)

*Content-Type:* `multipart/form-data`

```json
{
  "csv": "" // required
}
```

---

#### DELETE `/api/blacklisted-domains/{blacklisted_domain_id}`
**Remove blacklisted domain**

Remove a domain from the blacklist.

**Success Response (200):**

---

### Custom Tags
APIs for managing tags. This includes creating, retrieving, attaching to leads, and removing tags from leads.

#### GET `/api/tags`
**Get all tags for workspace**

Retrieve a list of all tags for the authenticated user's workspace.

**Success Response (200):**

---

#### POST `/api/tags`
**Create tag**

Add a new tag.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "name": "Important", // required
  "default": false // optional
}
```

---

#### GET `/api/tags/{id}`
**View tag**

View a saved tag.

---

#### DELETE `/api/tags/{tag_id}`
**Remove tag**

Delete a tag.

**Success Response (200):**

---

#### POST `/api/tags/attach-to-campaigns`
**Attach tags to campaigns**

Attach multiple tags to campaigns.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "tag_ids": [1, 2], // required
  "campaign_ids": [3, 4], // required
  "skip_webhooks": true // optional
}
```

**Success Response (200):**

---

#### POST `/api/tags/remove-from-campaigns`
**Remove tags from campaigns**

Detach multiple tags from campaigns.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "tag_ids": [1, 2], // required
  "campaign_ids": [3, 4], // required
  "skip_webhooks": false // optional
}
```

**Success Response (200):**

---

#### POST `/api/tags/attach-to-leads`
**Attach tags to leads**

Attach multiple tags to leads.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "tag_ids": [1, 2], // required
  "lead_ids": [3, 4], // required
  "skip_webhooks": false // optional
}
```

**Success Response (200):**

---

#### POST `/api/tags/remove-from-leads`
**Remove tags from leads**

Detach multiple tags from leads.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "tag_ids": [1, 2], // required
  "lead_ids": [3, 4], // required
  "skip_webhooks": true // optional
}
```

**Success Response (200):**

---

#### POST `/api/tags/attach-to-sender-emails`
**Attach tags to email accounts**

Attach multiple tags to email accounts

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "tag_ids": [1, 2], // required
  "sender_email_ids": [3, 4], // required
  "skip_webhooks": true // optional
}
```

**Success Response (200):**

---

#### POST `/api/tags/remove-from-sender-emails`
**Remove tags from email accounts**

Detach multiple tags from email accounts

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "tag_ids": [1, 2], // required
  "sender_email_ids": [3, 4], // required
  "skip_webhooks": false // optional
}
```

**Success Response (200):**

---

### Custom Tracking Domains
APIs for managing custom tracking domains. This includes retrieving, creating, and removing custom tracking domains.

#### GET `/api/custom-tracking-domain`
**Get all custom tracking domains**

Retrieve a list of all custom tracking domains for the authenticated user.

**Success Response (200):**

---

#### POST `/api/custom-tracking-domain`
**Create custom tracking domain**

Add a new custom tracking domain to the authenticated user's team.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "domain": "example.com" // required
}
```

---

#### GET `/api/custom-tracking-domain/{id}`
**Get a custom tracking domains**

View a custom tracking domains.

**Success Response (200):**

---

#### DELETE `/api/custom-tracking-domain/{custom_tracking_domain_id}`
**Remove custom tracking domain**

Delete a custom tracking domain.

**Success Response (200):**

---

### Webhooks
APIs for managing webhooks. This includes listing, creating, retrieving and deleting webhook urls.

#### GET `/api/webhook-url`
**Get all webhooks**

Retrieve a list of all webhooks for the authenticated user's workspace.

**Success Response (200):**

---

#### POST `/api/webhook-url`
**Create a new webhook**

Store a new webhook for the authenticated user's workspace. Provide an array of events to associate with the webhook; the events included in the array will be enabled.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "name": "Slack", // required
  "url": "https://your-webhook-url/webhooks", // required
  "events": ["email_sent", "lead_first_contacted", "lead_replied", "lead_interested", "email_opened", "email_bounced", "lead_unsubscribed", "email_account_added", "email_account_removed", "email_account_disconnected", "email_account_reconnected", "manual_email_sent", "untracked_reply_received"] // required
}
```

---

#### GET `/api/webhook-url/{id}`
**Get a single webhook**

Get the details of a specific webhook.

**Success Response (200):**

---

#### PUT `/api/webhook-url/{id}`
**Update a webhook**

Modify an existing webhook's details. Send an array of events to modify the webhook; the events included will be enabled, and those not included will be disabled.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "name": "Slack", // required
  "url": "https://your-webhook-url/webhooks", // required
  "events": ["email_sent", "lead_first_contacted", "lead_replied", "lead_interested", "email_opened", "email_bounced", "lead_unsubscribed", "email_account_added", "email_account_removed", "email_account_disconnected", "email_account_reconnected", "manual_email_sent", "untracked_reply_received"] // required
}
```

**Success Response (200):**

---

#### DELETE `/api/webhook-url/{webhook_url_id}`
**Delete a webhook**

Remove a webhook url by its ID.

**Success Response (200):**

---

### Campaign Events
Drill down into campaign event stats based on dates, campaign IDs, and/or sender email IDs

#### GET `/api/campaign-events/stats`
**Breakdown of events by date**

This endpoint retrieves stats by date for a given period, for this campaign Drill down into campaign event stats based on dates, campaign IDs, and/or sender email IDs The user must provide a valid authentication token in the request header to access this endpoint. Events returned: `Replied`, `Total Opens`, `Unique Opens`, `Sent`, `Bounced`, `Unsubscribed`, `Interested`

**Query Parameters:**
- `start_date` (string) (required): The start date to fetch stats.
- `end_date` (string) (required): The end date to fetch stats.
- `sender_email_ids` (array) (optional): List of sender email IDs to include
- `campaign_ids` (array) (optional): List of campaign IDs to include

**Success Response (200):**

---

### Campaigns v1.1
This section provides endpoints to manage campaign-related operations.

#### GET `/api/campaigns/v1.1/{campaign_id}/sequence-steps`
**View campaign sequence steps (v1.1)**

This endpoint allows the authenticated user to view the sequence steps of the campaign.

**Success Response (200):**

---

#### POST `/api/campaigns/v1.1/{campaign_id}/sequence-steps`
**Create sequence steps (v1.1)**

This endpoint allows the authenticated user to create the campaign sequence steps from scratch.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "title": "John Doe sequence", // required
  "sequence_steps": [{"email_subject": "EmailBison is awesome!", "email_subject_variables": ["{FIRST_NAME}"], "order": 1, "email_body": "Try it now!", "wait_in_days": 1, "variant": false, "thread_reply": false}, {"email_subject": "EmailBison is awesome!", "order": 2, "email_body": "Try it now!", "wait_in_days": 1, "variant": true, "variant_from_step": 1, "thread_reply": true}] // required
}
```

**Success Response (200):**

---

#### PUT `/api/campaigns/v1.1/sequence-steps/{sequence_id}`
**Update sequence steps (v1.1)**

This endpoint allows the authenticated user to update the campaign sequence steps.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "title": "John Doe sequence", // required
  "sequence_steps": [{"id": 1, "email_subject": "EmailBison is awesome!", "email_subject_variables": ["{FIRST_NAME}"], "order": 1, "email_body": "Try it now!", "wait_in_days": 1, "variant": false, "thread_reply": false}, {"id": 2, "email_subject": "EmailBison is awesome!", "order": 2, "email_body": "Try it now!", "wait_in_days": 1, "variant": true, "variant_from_step": 1, "thread_reply": true}] // required
}
```

**Success Response (200):**

---

### Custom Lead Variables
Here you can manage all custom variables created for a given workspace

#### GET `/api/custom-variables`
**Get all custom variables**

Retrieve a list of all custom variables for your workspace

**Success Response (200):**

---

#### POST `/api/custom-variables`
**Create a new custom variable**

Add a new custom variable for your workspace

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "name": "New Name" // required
}
```

**Success Response (200):**

---

### Ignore Phrases
APIs for managing ignore phrases. This includes retrieving, creating, and removing ignore phrases.

#### GET `/api/ignore-phrases`
**Get all ignore phrases**

Retrieve a list of all ignore phrases for the authenticated user.

**Success Response (200):**

---

#### POST `/api/ignore-phrases`
**Create ignore phrase**

Add a new ignore phrase

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "phrase": "warmup381" // required
}
```

---

#### GET `/api/ignore-phrases/{ignore_phrase_id}`
**Get single ignore phrase**

Retrieve the details of a specific ignore phrase

**Success Response (200):**

---

#### DELETE `/api/ignore-phrases/{ignore_phrase_id}`
**Remove ignore phrase**

Remove an ignore phrase

**Success Response (200):**

---

### Leads
This group of endpoints allows for the management of contact (lead) information.

#### GET `/api/leads`
**Get all leads**

Retrieve a list of all leads for the authenticated user.

**Query Parameters:**
- `search` (['string', 'null']) (optional): Search term for filtering replies.
- `filters` (object) (optional): 
- `filters.lead_campaign_status` (string) (optional): Filter by lead campaign status. One of `in_sequence`, `sequence_finished`, `sequence_stopped`, `never_contacted`, `replied`.
- `filters.emails_sent` (array) (optional): Filter by the number of emails sent.
- `filters.emails_sent.criteria` (string) (optional): Comparison operator for emails sent. One of `=`, `>=`, `>`, `<=`, `<`.
- `filters.emails_sent.value` (['integer', 'null']) (optional): Value for the number of emails sent.
- `filters.opens` (object) (optional): 
- `filters.opens.criteria` (string) (optional): Comparison operator for email opens. One of `=`, `>=`, `>`, `<=`, `<`.
- `filters.opens.value` (['integer', 'null']) (optional): Value for the number of email opens.
- `filters.replies` (object) (optional): 
- `filters.replies.criteria` (string) (optional): Comparison operator for replies. One of `=`, `>=`, `>`, `<=`, `<`.
- `filters.replies.value` (['integer', 'null']) (optional): Value for the number of replies.
- `filters.verification_statuses` (array) (optional): A verification status. Accepted values: `verifying`, `verified`, `risky`, `unknown`, `unverified`, `inactive`, `bounced`, `unsubscribed`
- `filters.tag_ids` (array) (optional): Filter by tag IDs.
- `filters.excluded_tag_ids` (array) (optional): Exclude leads by tag IDs.
- `filters.without_tags` (boolean) (optional): Only show leads that have no tags attached.
- `filters.created_at` (object) (optional): 
- `filters.created_at.criteria` (string) (optional): Comparison operator for the created_at date. One of `=`, `>=`, `>`, `<=`, `<`.
- `filters.created_at.value` (['string', 'null']) (optional): Value for the created_at date. Must be a valid date in YYYY-MM-DD format.
- `filters.updated_at` (object) (optional): 
- `filters.updated_at.criteria` (string) (optional): Comparison operator for the updated_at date. One of `=`, `>=`, `>`, `<=`, `<`.
- `filters.updated_at.value` (['string', 'null']) (optional): Value for the updated_at date. Must be a valid date in YYYY-MM-DD format.

**Success Response (200):**

---

#### POST `/api/leads`
**Create lead**

Create a single lead (contact) record

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "first_name": "John", // required
  "last_name": "Doe", // required
  "email": "john@doe.com", // required
  "title": "Engineer", // optional
  "company": "John Doe Company", // optional
  "notes": "Important client", // optional
  "custom_variables": [{"name": "phone number", "value": "9059999999"}] // optional
}
```

---

#### GET `/api/leads/{lead_id}`
**Get single lead**

Retrieve the details of a specific lead

**Success Response (200):**

---

#### PUT `/api/leads/{lead_id}`
**Update lead**

Update the details of a specific lead Fields passed in the request will be updated. Fields and custom variables not passed will be cleared.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "first_name": "John", // required
  "last_name": "Doe", // required
  "email": "john@doe.com", // required
  "title": "Engineer", // optional
  "company": "John Doe company", // optional
  "notes": "Important client", // optional
  "custom_variables": [{"name": "phone number", "value": "9059999999"}] // optional
}
```

**Success Response (200):**

---

#### PATCH `/api/leads/{lead_id}`
**Update lead**

Update the details of a specific lead Fields passed in the request will be updated. Fields and custom variables not passed will remain unchanged.

**Request Body:** (optional)

*Content-Type:* `application/json`

```json
{
  "first_name": "John", // optional
  "last_name": "Doe", // optional
  "email": "john@doe.com", // optional
  "title": "Engineer", // optional
  "company": "John Doe company", // optional
  "notes": "Important client", // optional
  "custom_variables": [{"name": "phone number", "value": "9059999999"}] // optional
}
```

**Success Response (200):**

---

#### GET `/api/leads/{lead_id}/replies`
**Get all replies for lead**

This endpoint retrieves all replies for a specific lead The user must provide a valid authentication token in the request header to access this endpoint.

**Query Parameters:**
- `search` (['string', 'null']) (optional): Search term for filtering replies.
- `status` (string) (optional): Filter by status. One of `interested`, `automated_reply`, `not_automated_reply`.
- `folder` (string) (optional): Filter by folder. One of `inbox`, `sent`, `spam`, `bounced`, `all`.
- `read` (['boolean', 'null']) (optional): Filter by read status.
- `campaign_id` (integer) (optional): The ID of the campaign.
- `sender_email_id` (integer) (optional): The ID of the sender email address.
- `tag_ids` (array) (optional): Array of tag IDs to filter by.

**Success Response (200):**

---

#### POST `/api/leads/multiple`
**Bulk create leads**

Create multiple lead records in a single request (limit 500 per request) Personal domains will be skipped unless enabled on your instance. get in touch with support if you want to send to personal domains (e.g. gmail.com)

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "leads": [[]] // required
}
```

---

#### POST `/api/leads/create-or-update/multiple`
**Update or create multiple leads**

Update or create multiple lead records in a single request (limit 500 per request). Personal domains will be skipped unless enabled on your instance. get in touch with support if you want to send to personal domains (e.g. gmail.com)

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "existing_lead_behavior": "put", // optional
  "leads": [[]] // required
}
```

---

#### POST `/api/leads/create-or-update/{lead_id}`
**Update or create lead**

Update the details of a specific lead if it exists, otherwise create a new record

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "existing_lead_behavior": "put", // optional
  "first_name": "John", // required
  "last_name": "Doe", // required
  "email": "john@doe.com", // required
  "title": "Engineer", // optional
  "company": "John Doe company", // optional
  "notes": "Important client", // optional
  "custom_variables": [{"name": "phone number", "value": "9059999999"}] // optional
}
```

**Success Response (200):**

---

#### PATCH `/api/leads/{lead_id}/unsubscribe`
**Unsubscribe lead**

Unsubscribe a lead from scheduled emails.

**Success Response (200):**

---

#### POST `/api/leads/{lead_id}/blacklist`
**Add lead to blacklist**

Add a lead to your global blacklist.

**Success Response (200):**

---

#### POST `/api/leads/bulk/csv`
**Bulk create leads using CSV**

Create multiple leads in a single request using a CSV

**Request Body:** (required)

*Content-Type:* `multipart/form-data`

```json
{
  "name": "John Doe's list", // required
  "csv": "", // required
  "existing_lead_behavior": "put", // optional
  "columnsToMap": [[]] // required
}
```

---

#### GET `/api/leads/{lead_id}/scheduled-emails`
**Get all scheduled emails**

Retrieves a collection of scheduled emails associated with a lead. These scheduled emails can have multiple statuses including: `scheduled`, `sending paused`, `stopped`, `bounced`, `unsubscribed`, `replied`

**Success Response (200):**

---

#### GET `/api/leads/{lead_id}/sent-emails`
**Get all sent emails for a lead**

Retrieves a collection of **sent** campaign emails associated with a lead on the authenticated workspace.

**Success Response (200):**

---

#### PATCH `/api/leads/{lead_id}/update-status`
**Update lead status**

Update the status of a lead

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "status": "unknown" // required
}
```

**Success Response (200):**

---

#### PATCH `/api/leads/bulk-update-status`
**Bulk update lead status**

Bulk update the status of multiple selected leads

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "lead_ids": [12], // required
  "status": "risky" // required
}
```

**Success Response (200):**

---

### Warmup
This section provides endpoints to let you manage your warmup settings for email accounts (sender emails)

#### GET `/api/warmup/sender-emails`
**List email accounts with warmup stats**

Retrieves a collection of email accounts associated with the authenticated workspace, along with their warmup stats

**Query Parameters:**
- `search` (['string', 'null']) (optional): optional Search term for filtering email accounts.
- `tag_ids` (array) (optional): optional Array of tag IDs to filter by.
- `excluded_tag_ids` (array) (optional): The <code>id</code> of an existing record in the tags table.
- `without_tags` (boolean) (optional): Only show leads that have no tags attached.
- `warmup_status` (string) (optional): The warmup status to filter by. Valid values: `enabled`, `disabled`
- `mx_records_status` (string) (optional): The mx records status to filter by. Valid values: `records missing`, `records valid`
- `start_date` (string) (required): The start date to fetch stats (defaults to 10 days ago).
- `end_date` (string) (required): The end date to fetch stats (defaults to today).
- `filters.excluded_tag_ids` (array) (optional): Exclude email accounts by tag IDs.
- `filters.without_tags` (boolean) (optional): Only show email accounts that have no tags attached.

**Success Response (200):**

---

#### PATCH `/api/warmup/sender-emails/enable`
**Enable warmup for email accounts**

This endpoint enables warmup for all the selected email accounts

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "sender_email_ids": [1, 2, 3] // required
}
```

**Success Response (200):**

---

#### PATCH `/api/warmup/sender-emails/disable`
**Disable warmup for email accounts**

This endpoint disables warmup for all the selected email accounts

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "sender_email_ids": [1, 2, 3] // required
}
```

**Success Response (200):**

---

#### PATCH `/api/warmup/sender-emails/update-daily-warmup-limits`
**Update daily warmup limits for email accounts**

This endpoint updates the daily warmup limits for selected email accounts

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "sender_email_ids": [1, 2, 3], // required
  "daily_limit": 7, // required
  "daily_reply_limit": "doloribus" // optional
}
```

**Success Response (200):**

---

#### GET `/api/warmup/sender-emails/{senderEmailId}`
**Show single email account with warmup details**

Retrieves a single email account (sender email) with its warmup details

**Query Parameters:**
- `start_date` (string) (required): The start date to fetch stats.
- `end_date` (string) (required): The end date to fetch stats.

**Success Response (200):**

---

### Webhook Events
APIs for managing webhook events, sending test events, and viewing samples

#### GET `/api/webhook-events/sample-payload`
**Get sample webhook event payload**

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "event_type": "email_sent" // required
}
```

**Success Response (200):**

---

#### GET `/api/webhook-events/event-types`
**Get all webhook event types**

Shows you a list of all valid webhook event types that are supported

**Success Response (200):**

---

#### POST `/api/webhook-events/test-event`
**Send a test webhook event**

Send a test webhook for a chosen event type

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "event_type": "email_sent", // required
  "url": "https://blue-square-32.webhook.cool" // required
}
```

**Success Response (200):**

---

### Workspaces v1 (deprecated)
This section provides endpoints to manage workspace-related operations. It includes functionalities for creating, updating, and deleting workspaces

#### GET `/api/workspaces`
**List Workspaces**

This endpoint retrieves all of the authenticated user's workspaces. The user must provide a valid authentication token in the request header to access this endpoint.

**Success Response (200):**

---

#### POST `/api/workspaces`
**Create Workspace**

This endpoint allows the authenticated user to create a new workspace. The user must provide a valid authentication token in the request header and the details of the new workspace in the request body.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "name": "New name" // required
}
```

**Success Response (200):**

---

#### POST `/api/workspaces/switch-workspace`
**Switch Workspace**

This endpoint allows the authenticated user to switch to a different workspace. The user must provide a valid authentication token in the request header and the ID of the target workspace in the request body to access this endpoint.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "team_id": 15 // required
}
```

**Success Response (200):**

---

#### PUT `/api/workspaces/{team_id}`
**Update Workspace**

This endpoint allows the authenticated user to update their workspace information, specifically the workspace name. The user must provide a valid authentication token in the request header and the ID of the target workspace, along with the details of the new workspace in the request body to access this endpoint.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "name": "New name" // required
}
```

**Success Response (200):**

---

#### GET `/api/workspaces/{team_id}`
**Workspace Details**

This endpoint retrieves the details of the authenticated user's workspace. The user must provide a valid authentication token in the request header to access this endpoint.

**Success Response (200):**

---

#### POST `/api/workspaces/invite-members`
**Invite Team Member**

This endpoint allows the authenticated user to invite a new member to their team. The user must provide a valid authentication token in the request header and the email and role of the new team member in the request body.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "email": "example@example.com", // required
  "role": "admin" // required
}
```

**Success Response (200):**

---

#### POST `/api/workspaces/accept/{team_invitation_id}`
**Accept Workspace Invitation**

This endpoint allows the user to accept an invitation to join a workspace. The user must provide a valid authentication token in the request header and the ID of the workspace invitation.

**Success Response (200):**

---

#### PUT `/api/workspaces/members/{user_id}`
**Update Workspace Member**

This endpoint allows the authenticated user to update the role of a workspace member. The user must provide a valid authentication token in the request header and the ID of the workspace member and the new role in the request body.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "role": "admin" // required
}
```

**Success Response (200):**

---

#### DELETE `/api/workspaces/members/{user_id}`
**Delete Workspace Member**

This endpoint allows the authenticated user to remove a workspace member. The user must provide a valid authentication token in the request header and the ID of the workspace member.

**Success Response (200):**

---

### Workspaces v1.1
This section provides endpoints to manage workspace-related operations. It includes functionalities for creating, updating, and deleting workspaces

#### GET `/api/workspaces/v1.1`
**List Workspaces**

This endpoint retrieves all of the authenticated user's workspaces. The user must provide a valid authentication token in the request header to access this endpoint.

**Success Response (200):**

---

#### POST `/api/workspaces/v1.1`
**Create Workspace**

This endpoint allows the authenticated user to create a new workspace. The user must provide a valid authentication token in the request header and the details of the new workspace in the request body.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "name": "New name" // required
}
```

**Success Response (200):**

---

#### POST `/api/workspaces/v1.1/users`
**Create User (and add to workspace)**

This endpoint provides a convenient way to create a new user on your instance, and add them to the current workspace. This provides an alternate flow where you want to mass create users. If you simply want to invite users and have them accept the invitation, or accept it programmatically, consider using the other endpoints.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "name": "John Doe", // required
  "password": "securepasswordlol", // required
  "email": "example@example.com", // required
  "role": "admin" // required
}
```

**Success Response (200):**

---

#### POST `/api/workspaces/v1.1/{team_id}/api-tokens`
**Create API token for workspace**

This endpoint lets you create an API token for a given workspace Requires a "super admin" API token

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "name": "New token" // required
}
```

**Success Response (200):**

---

#### POST `/api/workspaces/v1.1/switch-workspace`
**Switch Workspace**

This endpoint allows the authenticated user to switch to a different workspace. The user must provide a valid authentication token in the request header and the ID of the target workspace in the request body to access this endpoint.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "team_id": 17 // required
}
```

**Success Response (200):**

---

#### DELETE `/api/workspaces/v1.1/{team_id}`
**Delete Workspace**

This endpoint allows the authenticated user to delete a workspace. The user must provide a valid super-admin authentication token in the request header and the ID of the target workspace in the query parameters to access this endpoint.

**Success Response (200):**

---

#### PUT `/api/workspaces/v1.1/{team_id}`
**Update Workspace**

This endpoint allows the authenticated user to update their workspace information, specifically the workspace name. The user must provide a valid authentication token in the request header and the ID of the target workspace, along with the details of the new workspace in the request body to access this endpoint.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "name": "New name" // required
}
```

**Success Response (200):**

---

#### GET `/api/workspaces/v1.1/{team_id}`
**Workspace Details**

This endpoint retrieves the details of the authenticated user's workspace. The user must provide a valid authentication token in the request header to access this endpoint.

**Success Response (200):**

---

#### POST `/api/workspaces/v1.1/invite-members`
**Invite Team Member**

This endpoint allows the authenticated user to invite a new member to their team. The user must provide a valid authentication token in the request header and the email and role of the new team member in the request body.

**Request Body:** (required)

*Content-Type:* `application/json`

```json
{
  "email": "example@example.com", // required
  "role": "admin" // required
}
```

**Success Response (200):**

---

#### POST `/api/workspaces/v1.1/accept/{team_invitation_id}`
**Accept Workspace Invitation**

This endpoint allows the user to accept an invitation to join a workspace. The user must provide a valid authentication token in the request header and the ID of the workspace invitation.

**Success Response (200):**

---

#### DELETE `/api/workspaces/v1.1/members/{user_id}`
**Delete Workspace Member**

This endpoint allows the authenticated user to remove a workspace member. This does not delete the user account. It only removes them from the workspace. The user must provide a valid authentication token in the request header and the ID of the workspace member.

**Success Response (200):**

---

#### GET `/api/workspaces/v1.1/master-inbox-settings`
**Get Master Inbox Settings**

This endpoint retrieves the master inbox settings for this workspace. The user must provide a valid authentication token in the request header to access this endpoint.

**Success Response (200):**

---

#### PATCH `/api/workspaces/v1.1/master-inbox-settings`
**Update Master Inbox Settings**

This endpoint updates the master inbox settings for this workspace. The user must provide a valid authentication token in the request header to access this endpoint.

**Request Body:** (optional)

*Content-Type:* `application/json`

```json
{
  "sync_all_emails": false, // optional
  "smart_warmup_filter": false, // optional
  "auto_interested_categorization": false // optional
}
```

**Success Response (200):**

---

#### GET `/api/workspaces/v1.1/stats`
**Get workspace stats (summary)**

This endpoint retrieves overall stats for this workspace between two given dates. The user must provide a valid authentication token in the request header to access this endpoint.

**Query Parameters:**
- `start_date` (string) (required): The start date to fetch stats.
- `end_date` (string) (required): The end date to fetch stats.

**Success Response (200):**

---

#### GET `/api/workspaces/v1.1/line-area-chart-stats`
**Get full normalized stats by date**

This endpoint retrieves stats by date for a given period The user must provide a valid authentication token in the request header to access this endpoint. Events returned: `Replied`, `Total Opens`, `Unique Opens`, `Sent`, `Bounced`, `Unsubscribed`, `Interested`

**Query Parameters:**
- `start_date` (string) (required): The start date to fetch stats.
- `end_date` (string) (required): The end date to fetch stats.

**Success Response (200):**

---

