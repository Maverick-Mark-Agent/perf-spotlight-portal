# Email to Email Guard Support - Inbox Placement Test Discrepancy

---

**Subject:** Urgent: Significant Discrepancy Between Two Inbox Placement Tests Conducted 3-4 Days Apart

---

Dear Email Guard Support Team,

I hope this message finds you well. I'm writing to bring to your attention a significant and concerning discrepancy between two inbox placement tests we conducted just 3-4 days apart. The dramatic differences in results suggest potential data accuracy issues that we need to address urgently.

## Test Overview

- **First Test Date:** November 13-14, 2025
- **Second Test Date:** November 16, 2025
- **Time Difference:** 3-4 days
- **Testing Conditions:** Same infrastructure, same email accounts, same sending patterns

## Critical Discrepancies Identified

### 1. **Total Burned Accounts**
- **First Test:** 317 burned accounts
- **Second Test:** 388 burned accounts
- **Difference:** +71 accounts (22% increase)
- **Issue:** How did 71 additional accounts fail in just 3-4 days when no major sending changes occurred?

### 2. **Client-Specific Discrepancies**

#### Rob Russell
- **First Test:** 45 burned accounts
- **Second Test:** 188 burned accounts
- **Difference:** +143 accounts (318% increase) ⚠️
- **Critical Issue:** This is a 4x increase in failures

#### Danny Schwartz
- **First Test:** 69 burned accounts
- **Second Test:** 73 burned accounts
- **Difference:** +4 accounts (6% increase)

#### Devin Hodo
- **First Test:** 63 burned accounts
- **Second Test:** 5 burned accounts
- **Difference:** -58 accounts (92% decrease) ⚠️
- **Critical Issue:** 58 accounts that were marked as "burned" are now passing?

#### Nick Sakha
- **First Test:** 4 burned accounts
- **Second Test:** 60 burned accounts
- **Difference:** +56 accounts (1,400% increase) ⚠️
- **Critical Issue:** This is a 15x increase in failures

#### Jason Binyon
- **First Test:** 60 burned accounts
- **Second Test:** 32 burned accounts
- **Difference:** -28 accounts (47% decrease)

#### Gregg Blanchard
- **First Test:** 27 burned accounts
- **Second Test:** 1 burned account
- **Difference:** -26 accounts (96% decrease) ⚠️

### 3. **Reseller/Provider Distribution Discrepancies**

#### Zapmail
- **First Test:** 167 accounts (53%)
- **Second Test:** 121 accounts (31%)
- **Difference:** -46 accounts

#### CheapInboxes
- **First Test:** 122 accounts (39%)
- **Second Test:** 98 accounts (25%)
- **Difference:** -24 accounts

#### Untagged Accounts (N/A)
- **First Test:** 8 accounts
- **Second Test:** 151 accounts
- **Difference:** +143 accounts ⚠️
- **Critical Issue:** All 151 untagged accounts belong to Rob Russell

## Why This Data Seems Inaccurate

1. **Extreme Volatility:** Inbox placement should not fluctuate this dramatically in 3-4 days with consistent sending behavior
   - Rob Russell: 45 → 188 (+318%)
   - Devin Hodo: 63 → 5 (-92%)
   - Nick Sakha: 4 → 60 (+1,400%)
   - Gregg Blanchard: 27 → 1 (-96%)

2. **Contradictory Results:** Some clients improved dramatically while others degraded catastrophically, despite:
   - Same email infrastructure
   - Same sending patterns
   - Same warmup protocols
   - Same content strategies

3. **Massive Tagging Discrepancy:** 151 Rob Russell accounts suddenly appear as "untagged" in the second test, all marked as Outlook accounts with no company/reseller information

4. **Statistical Improbability:** The variance between tests (±1,400% for Nick Sakha, ±318% for Rob Russell) exceeds any reasonable expectation for organic deliverability changes over 3-4 days

## Our Concerns

1. **Test Methodology:** Are the two tests using the same seed list and testing criteria?
2. **Data Collection:** Could there be a difference in how burned accounts are identified between the two tests?
3. **Account Tagging:** Why did 151 Rob Russell accounts lose their company/reseller tags between tests?
4. **Sample Size:** Are both tests using the same sample size and account selection methodology?
5. **Timing/Caching:** Could there be cached results or timing issues affecting the second test?

## Requested Actions

We need your team to:

1. **Investigate the discrepancy** between these two test results
2. **Verify the testing methodology** used for both tests
3. **Explain the extreme variance** in client-specific results (especially Rob Russell, Devin Hodo, Nick Sakha, and Gregg Blanchard)
4. **Clarify the tagging issue** that caused 151 accounts to appear as "untagged" in the second test
5. **Provide guidance** on which test results we should rely on for our infrastructure decisions
6. **Re-run the test** if necessary to establish accurate baseline data

## Business Impact

These inconsistencies are preventing us from:
- Making informed decisions about which resellers to continue using
- Properly allocating our email infrastructure budget
- Identifying which accounts need immediate remediation
- Trusting future inbox placement test results

We rely on Email Guard for accurate, actionable deliverability data. The current discrepancy undermines confidence in the testing process and puts our email operations at risk.

Please prioritize this investigation and provide us with:
1. An explanation for the discrepancies
2. Corrected/verified test results
3. Recommendations for next steps

We're happy to schedule a call to discuss this in detail if that would be helpful.

Thank you for your prompt attention to this matter.

---

**Best regards,**

[Your Name]
[Your Title]
Maverick Marketing LLC
[Your Email]
[Your Phone]

---

## Appendix: Detailed Comparison Data

### Test 1 (Nov 13-14) - By Client
| Client | Burned Accounts | Top Reseller |
|--------|----------------|--------------|
| Danny Schwartz | 69 | Zapmail (55) |
| Devin Hodo | 63 | Zapmail (55) |
| Jason Binyon | 60 | CheapInboxes (43) |
| Rob Russell | 45 | CheapInboxes (34) |
| Kim Wallace | 32 | Zapmail (15) |
| Gregg Blanchard | 27 | Zapmail (27) |
| John Roberts | 8 | CheapInboxes (8) |
| Kirk Hodgson | 5 | CheapInboxes (5) |
| Nick Sakha | 4 | Zapmail (4) |
| SMA Insurance | 1 | ScaledMail (1) |

### Test 2 (Nov 16) - By Client
| Client | Burned Accounts | Top Reseller |
|--------|----------------|--------------|
| Rob Russell | 188 | **UNTAGGED (151)** |
| Danny Schwartz | 73 | Zapmail (48) |
| Nick Sakha | 60 | Zapmail (60) |
| Jason Binyon | 32 | CheapInboxes (17) |
| Kim Wallace | 15 | CheapInboxes (11) |
| John Roberts | 8 | CheapInboxes (8) |
| Devin Hodo | 5 | CheapInboxes (3) |
| Tony Schmitz | 2 | CheapInboxes (2) |
| SMA Insurance | 2 | ScaledMail (2) |
| Gregg Blanchard | 1 | Zapmail (1) |

### Test 1 vs Test 2 - Change Analysis
| Client | Test 1 | Test 2 | Change | % Change |
|--------|--------|--------|--------|----------|
| Rob Russell | 45 | 188 | +143 | **+318%** ⚠️ |
| Nick Sakha | 4 | 60 | +56 | **+1,400%** ⚠️ |
| Danny Schwartz | 69 | 73 | +4 | +6% |
| Devin Hodo | 63 | 5 | -58 | **-92%** ⚠️ |
| Jason Binyon | 60 | 32 | -28 | -47% |
| Gregg Blanchard | 27 | 1 | -26 | **-96%** ⚠️ |
| Kim Wallace | 32 | 15 | -17 | -53% |
| John Roberts | 8 | 8 | 0 | 0% |

---

**Files Attached:**
- `burned-accounts-with-tags.csv` (First Test - Nov 13-14)
- `burned-accounts-with-tags-new.csv` (Second Test - Nov 16)
