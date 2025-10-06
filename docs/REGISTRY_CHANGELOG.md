# Client Registry Changelog

This file tracks all changes to the client registry over time.

## Format

Each entry follows this format:
```
YYYY-MM-DD HH:MM | Client Name | field: old → new | Reason
```

## Changes

### 2025-10-06

2025-10-06 20:30 | Kim Wallace | webhook_id: 92 → 93 | Verified via API - webhook recreated
2025-10-06 20:30 | Rick Huemmer | webhook_id: null → 94 | Webhook created during audit remediation
2025-10-06 20:30 | StreetSmart Commercial | webhook_id: 84 → 83 | Corrected via workspace verification
2025-10-06 20:30 | StreetSmart P&C | webhook_id: 85 → 82 | Corrected via workspace verification
2025-10-06 20:30 | StreetSmart Trucking | webhook_id: 90 → 84 | Corrected via workspace verification
2025-10-06 20:30 | John Roberts | notes updated | JWT issue fixed, webhook 78 verified with multiple integrations

---

**Note**: This changelog started on 2025-10-06. Previous changes are documented in git history.

To view full git history:
```bash
git log --follow --oneline -- scripts/client-registry.json
```
