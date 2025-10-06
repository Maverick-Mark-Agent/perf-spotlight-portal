# SOP Template and Documentation Standards

**Last Updated**: 2025-10-06
**Owner**: Engineering Team
**Status**: Active

## Purpose

This document establishes the standard operating procedure for creating, maintaining, and organizing all technical documentation, runbooks, and SOPs in this project. Following these standards ensures:

1. **Consistency** - All documentation follows the same structure
2. **Discoverability** - Engineers can quickly find relevant procedures
3. **Completeness** - Critical information is never omitted
4. **Maintainability** - Documentation can be easily updated as systems evolve
5. **Reduced Repetition** - We don't solve the same problems multiple times

## When to Create Documentation

### Immediate Triggers (Create SOP Immediately)

Create documentation **immediately** when:

1. **Solving a Recurring Problem**
   - You've solved this exact problem before
   - User says "we've had this issue before"
   - You find yourself searching chat history for previous solutions
   - Example: Kim Wallace webhook issue after Devin Hodo webhook issue

2. **Complex Multi-Step Procedures**
   - Procedure requires >5 steps
   - Involves multiple systems (Email Bison + Supabase + Database)
   - Requires specific API calls or commands
   - Easy to miss critical steps
   - Example: Syncing interested leads from Email Bison

3. **Critical Business Operations**
   - Client-facing operations (CRM sync, data pipelines)
   - Data integrity procedures (database migrations, backfills)
   - System configuration (webhooks, API keys, deployments)
   - Security-sensitive operations (credential management, access control)

4. **Learned from Failure**
   - You tried approach A, it failed, approach B worked
   - There are wrong/broken approaches to avoid
   - API quirks or undocumented behavior
   - Example: Tag filtering vs reply status endpoint

5. **User Requests Documentation**
   - User explicitly asks "can we document this?"
   - User expresses frustration about repeating same issue
   - User asks "how do I do X next time?"

### Scheduled Triggers (Create SOP Within 24 Hours)

Create documentation within 24 hours when:

1. **New System Integration**
   - Adding new external API (Email Bison, Airtable, etc.)
   - Setting up new database tables or schemas
   - Implementing new automated workflows

2. **Onboarding Requirements**
   - New team member would need this knowledge
   - Procedure is non-obvious from reading code
   - Requires specific domain knowledge

### Optional (Consider Creating)

Documentation is optional but recommended for:

1. **One-Time Scripts** - If they might be referenced as templates
2. **Simple Procedures** - If they have critical gotchas
3. **Internal Tools** - If they have specific usage patterns

## Documentation Types

### 1. Runbook

**Purpose**: Step-by-step operational procedure for specific tasks

**When to Use**:
- Diagnostic procedures (troubleshooting webhooks)
- Data sync operations (syncing leads)
- System maintenance (health checks)

**Structure**: See [Runbook Template](#runbook-template)

**Location**: `docs/runbooks/`

**Examples**:
- `SYNC_CLIENT_LEADS.md`
- `WEBHOOK_TROUBLESHOOTING.md`
- `EMAIL_BISON_INTERESTED_LEADS.md`

### 2. API Reference

**Purpose**: Complete API documentation for external services

**When to Use**:
- Integrating with third-party APIs
- Documenting API quirks and patterns
- Recording authentication methods

**Structure**: See [API Reference Template](#api-reference-template)

**Location**: `docs/`

**Examples**:
- `EMAIL_BISON_API_REFERENCE.md`
- `AIRTABLE_API_REFERENCE.md`

### 3. Architecture Documentation

**Purpose**: High-level system design and data flow

**When to Use**:
- New system components
- Complex integrations
- Multi-service workflows

**Structure**: See [Architecture Doc Template](#architecture-doc-template)

**Location**: `docs/architecture/`

**Examples**:
- `AGENT_ARCHITECTURE.md`
- `CRM_PIPELINE_FLOW.md`

### 4. Fix Documentation

**Purpose**: Detailed account of a specific bug fix or issue resolution

**When to Use**:
- Complex bugs that took >2 hours to solve
- Issues likely to recur
- Fixes that establish new patterns

**Structure**: See [Fix Documentation Template](#fix-documentation-template)

**Location**: `docs/fixes/` or `docs/`

**Examples**:
- `DEVIN_HODO_FIX_README.md`

### 5. Configuration Documentation

**Purpose**: How to configure systems, credentials, and environments

**When to Use**:
- Setting up new clients
- Environment-specific configuration
- Credential management

**Location**: `docs/config/`

## Runbook Template

Use this template for all runbook documentation:

````markdown
# Runbook: [Descriptive Title]

**Last Updated**: YYYY-MM-DD
**Owner**: [Team/Person]
**Status**: [Active | Deprecated | Draft]

## Overview

[2-3 sentence summary of what this runbook does and why it exists]

## When to Use This Runbook

Use this procedure when:
- [Specific scenario 1]
- [Specific scenario 2]
- [Specific scenario 3]

## Prerequisites

### Access Required
- [System/credential 1]
- [System/credential 2]

### Files Needed
- [File path 1 with description]
- [File path 2 with description]

### Tools
- [Tool 1]
- [Tool 2]

## Step-by-Step Procedure

### Step 1: [Action Name]

[Explanation of what this step does and why]

```bash
# Command or code example
command --with-flags
```

**Expected Output**:
```
[Show what success looks like]
```

**Problem Indicators**:
- [Error message or symptom]
- [Another error message or symptom]

### Step 2: [Action Name]

[Continue with remaining steps...]

## Common Errors and Fixes

### Error 1: [Error Name/Description]

**Symptom**:
```
[Error message or behavior]
```

**Cause**: [Why this happens]

**Fix**:
```bash
# Solution commands
```

### Error 2: [Continue with other common errors...]

## Script Template

[If applicable, provide complete working script]

```bash
#!/bin/bash
# Full working script
```

## Troubleshooting Decision Tree

```
[Problem Statement]
│
├─ Check: [First diagnostic question]
│  ├─ Yes → [Action or next step]
│  └─ No → [Alternative action]
│
├─ Check: [Second diagnostic question]
│  └─ ...
```

## Related Documentation

- [Link to related runbook 1](./RELATED.md)
- [Link to related runbook 2](./RELATED2.md)

## Success Criteria

✅ [Procedure] is successful when:
1. [Measurable outcome 1]
2. [Measurable outcome 2]
3. [Measurable outcome 3]

## Notes

- **Critical insight or warning**
- **Important pattern or practice**
- **Link to related issue or discussion**

## Lessons Learned

### From [Specific Incident/Date]
- [What we learned]
- [What changed as a result]

### From [Another Incident/Date]
- [What we learned]
- [What changed as a result]
````

## API Reference Template

Use this template for API documentation:

````markdown
# [Service Name] API Reference

**Version**: [API Version]
**Base URL**: `https://api.example.com`
**Documentation**: [Link to official docs]
**Last Updated**: YYYY-MM-DD

## Authentication

### [Auth Method Name]

[Explanation of how authentication works]

```bash
# Example request with auth
curl -H "Authorization: Bearer TOKEN" https://api.example.com/resource
```

### API Keys

**Super Admin Key**: [Where stored, how to use]
**Workspace Keys**: [Where stored, how to use]

## Core Concepts

### [Concept 1: e.g., Workspaces]

[Explanation of the concept]

### [Concept 2: e.g., Workspace Switching]

[Explanation of the concept]

## Endpoints

### [HTTP METHOD] /endpoint/path

**Description**: [What this endpoint does]

**Authentication**: [Required auth method]

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| param1 | string | Yes | [Description] |
| param2 | number | No | [Description] |

**Example Request**:
```bash
curl -X GET "https://api.example.com/endpoint/path?param1=value" \
  -H "Authorization: Bearer TOKEN"
```

**Example Response**:
```json
{
  "data": [...],
  "meta": {...}
}
```

**Common Errors**:
- `401 Unauthorized` - [When this happens and how to fix]
- `404 Not Found` - [When this happens and how to fix]

**Rate Limits**: [Rate limiting info]

**Pagination**: [How pagination works for this endpoint]

## Common Patterns

### [Pattern 1: e.g., Querying Across Workspaces]

[Explanation and code example]

### [Pattern 2: e.g., Handling Pagination]

[Explanation and code example]

## Quirks and Gotchas

### [Quirk 1]

**Issue**: [Description of unexpected behavior]
**Workaround**: [How to handle it]
**Why**: [Explanation if known]

## Testing

### Test Credentials

[How to get test credentials or use sandbox]

### Example Requests

[Collection of common request examples]

## Related Documentation

- [Link to runbook using this API]
- [Link to integration documentation]
````

## Architecture Doc Template

Use this template for architecture documentation:

````markdown
# [System Name] Architecture

**Last Updated**: YYYY-MM-DD
**Status**: [Active | Proposed | Deprecated]

## Overview

[High-level summary of the system]

## Goals and Non-Goals

### Goals
- [Primary goal 1]
- [Primary goal 2]

### Non-Goals
- [Explicit exclusion 1]
- [Explicit exclusion 2]

## Architecture Diagram

```
[ASCII or mermaid diagram showing components and data flow]
```

## Components

### [Component 1]

**Purpose**: [What this component does]
**Technology**: [Stack/framework]
**Location**: [File path or service URL]

**Responsibilities**:
- [Responsibility 1]
- [Responsibility 2]

**Interfaces**:
- Input: [What it receives]
- Output: [What it produces]

### [Component 2]

[Continue with other components...]

## Data Flow

### [Primary Flow 1]

```
[Step-by-step data flow diagram]
```

1. [Step 1 explanation]
2. [Step 2 explanation]

### [Primary Flow 2]

[Continue with other flows...]

## Database Schema

### [Table Name]

```sql
CREATE TABLE table_name (
  id BIGSERIAL PRIMARY KEY,
  field1 TYPE NOT NULL,
  ...
);
```

**Indexes**:
- `idx_name` - [Why this index exists]

**Constraints**:
- [Constraint description]

## API Contracts

### [Service 1] → [Service 2]

**Endpoint**: `POST /api/endpoint`

**Request**:
```json
{
  "field": "value"
}
```

**Response**:
```json
{
  "result": "value"
}
```

## Deployment

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| VAR_NAME | Yes | [Description] |

### Dependencies

- [External service 1]
- [External service 2]

## Monitoring

### Key Metrics

- [Metric 1] - [Why it matters]
- [Metric 2] - [Why it matters]

### Alerts

- [Alert condition] → [Action to take]

## Security Considerations

- [Security concern 1 and mitigation]
- [Security concern 2 and mitigation]

## Future Improvements

- [Planned improvement 1]
- [Planned improvement 2]

## Related Documentation

- [Link to related architecture]
- [Link to runbooks for this system]
````

## Fix Documentation Template

Use this template for bug fix documentation:

````markdown
# Fix: [Brief Description of the Issue]

**Date**: YYYY-MM-DD
**Affected Systems**: [List of systems]
**Severity**: [Critical | High | Medium | Low]
**Status**: Resolved

## Problem Statement

[Clear description of the bug or issue]

**Symptoms**:
- [Observable symptom 1]
- [Observable symptom 2]

**Impact**:
- [Business impact]
- [Technical impact]

## Root Cause Analysis

[Detailed explanation of why the bug occurred]

### Timeline of Events

1. **[Date/Time]** - [What happened]
2. **[Date/Time]** - [What happened]
3. **[Date/Time]** - [What happened]

### Investigation Steps

1. [What we checked first]
2. [What we discovered next]
3. [Final discovery]

## Solution

### What Was Changed

[Explanation of the fix]

### Code Changes

```diff
- old code
+ new code
```

### Configuration Changes

[Any config or infrastructure changes]

## Verification

### How to Test the Fix

```bash
# Test commands
```

### Expected Results

[What should happen after the fix]

### Actual Results

[Confirmation that fix worked]

## Prevention

### New Safeguards

- [Monitoring added]
- [Validation added]
- [Documentation created]

### Process Changes

- [What we'll do differently]

## Lessons Learned

1. [Key lesson 1]
2. [Key lesson 2]

## Related Documentation

- [Link to runbook created from this fix]
- [Link to related issues]
````

## Documentation Organization

### Directory Structure

```
docs/
├── README.md                      # Documentation index
├── SOP_TEMPLATE.md               # This file
│
├── runbooks/                     # Operational procedures
│   ├── SYNC_CLIENT_LEADS.md
│   ├── WEBHOOK_TROUBLESHOOTING.md
│   └── EMAIL_BISON_INTERESTED_LEADS.md
│
├── architecture/                 # System design docs
│   ├── AGENT_ARCHITECTURE.md
│   └── CRM_PIPELINE.md
│
├── api/                          # API references
│   ├── EMAIL_BISON_API_REFERENCE.md
│   └── SUPABASE_API_REFERENCE.md
│
├── fixes/                        # Bug fix documentation
│   └── DEVIN_HODO_FIX_README.md
│
├── config/                       # Configuration guides
│   ├── CLIENT_SETUP.md
│   └── ENV_VARIABLES.md
│
└── scripts/                      # Script documentation
    └── README.md
```

### Naming Conventions

**Runbooks**: `[ACTION]_[SUBJECT].md`
- Examples: `SYNC_CLIENT_LEADS.md`, `WEBHOOK_TROUBLESHOOTING.md`, `DEPLOY_PRODUCTION.md`

**API Docs**: `[SERVICE]_API_REFERENCE.md`
- Examples: `EMAIL_BISON_API_REFERENCE.md`, `STRIPE_API_REFERENCE.md`

**Architecture**: `[SYSTEM]_ARCHITECTURE.md`
- Examples: `AGENT_ARCHITECTURE.md`, `PIPELINE_ARCHITECTURE.md`

**Fixes**: `[SUBJECT]_FIX_README.md` or `FIX_[ISSUE_NUMBER].md`
- Examples: `DEVIN_HODO_FIX_README.md`, `FIX_1234.md`

**Use SCREAMING_SNAKE_CASE** for all documentation files to make them highly visible.

### Cross-Referencing

**Always link related documentation**:

```markdown
## Related Documentation

- [SYNC_CLIENT_LEADS.md](./SYNC_CLIENT_LEADS.md) - How to sync leads manually
- [EMAIL_BISON_API_REFERENCE.md](../EMAIL_BISON_API_REFERENCE.md) - API details
- [Fix: Devin Hodo Issue](../DEVIN_HODO_FIX_README.md) - Original discovery
```

**Link from code to documentation**:

```typescript
// See docs/runbooks/WEBHOOK_TROUBLESHOOTING.md for webhook setup
async function createWebhook(workspaceId: number) {
  // ...
}
```

## Documentation Maintenance

### Review Schedule

**Monthly**: Review all `Active` runbooks
- Verify procedures still work
- Update API changes
- Add newly discovered patterns

**Quarterly**: Review architecture documentation
- Update for new features
- Deprecate outdated approaches
- Add diagrams for new systems

**After Each Major Incident**: Review and update fix documentation

### Version Control

**All documentation must be in Git**:
- Commit docs alongside code changes
- Use meaningful commit messages
- Link to PRs that implement procedures

**Document Status Field**:
- `Active` - Current and maintained
- `Draft` - In progress
- `Deprecated` - Replaced by newer approach (link to replacement)

### Deprecation Process

When a procedure becomes outdated:

1. Add `⚠️ DEPRECATED` to the top of the document
2. Link to the replacement documentation
3. Keep the old doc for historical reference
4. Move to `docs/deprecated/` after 6 months

Example:
```markdown
# ⚠️ DEPRECATED - Syncing Leads via Tag Filtering

**This approach no longer works. Use [SYNC_CLIENT_LEADS.md](./SYNC_CLIENT_LEADS.md) instead.**

**Deprecated**: 2025-10-06
**Reason**: Tag filtering endpoint is unreliable
**Replacement**: Reply status endpoint approach

---

[Original documentation preserved below]
```

## Writing Style Guide

### Tone
- **Clear and Direct**: No fluff, get to the point
- **Imperative**: "Run this command", not "You should run this command"
- **Specific**: Use exact file paths, commands, and values
- **Empathetic**: Remember the reader might be stressed/debugging

### Formatting

**Commands**: Always use code blocks with language hints
```bash
# Good
curl -X GET https://api.example.com
```

**Variables**: Clearly mark what needs to be replaced
```bash
# Use descriptive placeholder names
WORKSPACE_ID=4  # Replace with actual workspace ID
```

**Examples**: Show both request AND expected response
```bash
# Request
curl https://api.example.com/users/1

# Expected Response
{"id": 1, "name": "John"}
```

**Warnings**: Use clear formatting for critical information
```markdown
**CRITICAL**: Always backup the database before running this script.

⚠️ **Warning**: This operation cannot be undone.

❌ **DO NOT**: Use tag filtering for interested leads.

✅ **DO**: Use reply status endpoint instead.
```

### Code Examples

**Complete and Runnable**: All code examples should be copy-paste ready

```bash
# Bad (missing values)
curl -H "Authorization: Bearer TOKEN" https://api.example.com

# Good (complete example)
TOKEN="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio"
curl -H "Authorization: Bearer ${TOKEN}" https://api.example.com
```

**Explain Non-Obvious Parts**:
```bash
# Switch workspace context (required before querying workspace data)
curl -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"workspace_id\": ${WORKSPACE_ID}}"

# Wait for context switch to complete
sleep 2
```

## Quality Checklist

Before marking documentation as `Active`, verify:

### Completeness
- [ ] All sections from template are filled out
- [ ] All code examples are complete and tested
- [ ] All related docs are cross-referenced
- [ ] Success criteria are measurable

### Accuracy
- [ ] All commands run successfully
- [ ] All file paths exist
- [ ] All API endpoints are current
- [ ] All credentials/keys are correct format (not actual secrets!)

### Usability
- [ ] Someone unfamiliar with the system could follow it
- [ ] Common errors are documented with fixes
- [ ] Troubleshooting steps are included
- [ ] Prerequisites are clearly stated

### Maintenance
- [ ] Last updated date is current
- [ ] Owner/team is assigned
- [ ] Status is set correctly
- [ ] Deprecation policy is clear

## Standard Practices

### 1. Document While Solving, Not After

**DON'T**: Fix the issue, then try to remember what you did
**DO**: Write the runbook as you execute the fix

### 2. Include What Didn't Work

**DON'T**: Only show the final working solution
**DO**: Document failed approaches and why they failed

Example:
```markdown
## Common Errors

### ❌ Attempted: Tag Filtering
We initially tried `/api/leads?filters[tag_ids][]=31` but this:
- Times out with large datasets
- Returns 0 results despite leads existing
- Is not recommended by API

### ✅ Solution: Reply Status Endpoint
Use `/api/replies?status=interested` instead because:
- Fast and reliable
- Properly indexed
- Returns complete results
```

### 3. Test Your Documentation

**Before marking as complete**:
1. Have someone else follow the runbook
2. Verify all commands actually work
3. Check that links resolve
4. Validate JSON/YAML syntax

### 4. Link to Documentation in PR Descriptions

When creating a PR that implements a procedure:

```markdown
## Changes
- Implemented webhook creation for new clients

## Documentation
- 📘 See [docs/runbooks/WEBHOOK_SETUP.md](../docs/runbooks/WEBHOOK_SETUP.md)
- 📘 See [docs/CLIENT_ONBOARDING.md](../docs/CLIENT_ONBOARDING.md)
```

### 5. Update Documentation When Code Changes

**Every PR that changes behavior should update docs**:
- New API endpoint → Update API reference
- Changed procedure → Update runbook
- New error case → Add to troubleshooting section

## Enforcement

### Code Review Requirements

**PRs must include documentation when**:
- Adding new external API integration
- Implementing complex multi-step procedures
- Fixing bugs that took >2 hours to diagnose
- Creating client-facing features
- Adding configuration or deployment steps

**Reviewers should verify**:
- Documentation follows template structure
- Code examples are tested and complete
- Cross-references are correct
- Success criteria are measurable

### Documentation Debt

If a PR needs documentation but it's not ready:
1. Create documentation stub with `Status: Draft`
2. Add TODO comment in code linking to draft
3. Create follow-up issue to complete documentation
4. Complete within 3 business days

## Success Metrics

We know our documentation is working when:

1. **Reduced Repeat Issues**
   - Metric: # of times same issue is debugged
   - Target: <2 times (first time = create doc, subsequent = follow doc)

2. **Faster Resolution**
   - Metric: Time to resolve documented vs undocumented issues
   - Target: 50% faster with documentation

3. **Self-Service Rate**
   - Metric: % of issues resolved without asking for help
   - Target: >70% for documented procedures

4. **Documentation Coverage**
   - Metric: % of recurring procedures with runbooks
   - Target: >90%

## Examples in This Project

### Excellent Examples

✅ **SYNC_CLIENT_LEADS.md**
- Complete step-by-step procedure
- Shows both correct and incorrect approaches
- Includes working script template
- Decision tree for troubleshooting
- Clear success criteria

✅ **WEBHOOK_TROUBLESHOOTING.md**
- Covers all common issues
- Diagnostic steps are clear
- Links to related documentation
- Includes monitoring recommendations

✅ **DEVIN_HODO_FIX_README.md**
- Detailed problem analysis
- Shows investigation process
- Documents lessons learned
- Led to creation of new runbooks

### Needs Improvement

⚠️ **sync-bison-interested-leads** (Supabase function)
- No accompanying documentation
- Uses tag filtering approach (known broken)
- Should be deprecated with link to correct approach

## Getting Started

### For Your First Documentation

1. Pick the template that matches your need (runbook, API, architecture, fix)
2. Copy the template to appropriate location
3. Fill out all sections (don't skip any)
4. Test all commands and examples
5. Ask for review before marking as `Active`
6. Cross-link from related code and docs

### For Updating Existing Documentation

1. Update the "Last Updated" date
2. Mark changes with **NEW** or **UPDATED** tags temporarily
3. Add to "Lessons Learned" section if learned from new incident
4. Update related documentation with cross-references
5. Note the update in commit message

## Questions?

If you're unsure whether to create documentation:
- **Default to YES** - Over-documentation is better than under-documentation
- **Ask yourself**: "Will I remember how to do this in 3 months?"
- **Ask yourself**: "Could a new team member do this without my help?"

If the answer to either is "no", create documentation.

## Related Files

- [docs/runbooks/](./runbooks/) - All operational runbooks
- [docs/EMAIL_BISON_API_REFERENCE.md](./EMAIL_BISON_API_REFERENCE.md) - Example API reference
- [scripts/README.md](../scripts/README.md) - Script documentation
