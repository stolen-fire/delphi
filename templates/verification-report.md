# Forensic Verification Report

**Audit ID:** {audit_id}
**Audit date:** {audit_date}
**Inquiry:** {audit_inquiry}
**Investigator:** {audit_investigator}
**Verification date:** {verification_date}
**Manifest:** {manifest_path}

---

## Feedback Patterns Applied

{If feedback log had matching patterns:}

| # | Pattern | Prior lesson | Applied to |
|---|---------|-------------|------------|
| {N} | {pattern slug} | {lesson text} | Assertion {cluster}.{index} |

{If no matching patterns: "No prior patterns matched this audit's assertions."}

## Consensus Matrix

| Cluster | Assertion | Claim | Forward | Reverse | Cross | Consensus | Notes |
|---------|-----------|-------|---------|---------|-------|-----------|-------|
| {cluster_id} | {index} | {claim text, truncated to 60 chars} | {CONFIRM/DISPUTE} | {CONFIRM/DISPUTE} | {CONFIRM/DISPUTE} | {CONFIRMED/DISCREPANCY/UNVERIFIED} | {notes} |

## Discrepancies

{For each DISCREPANCY verdict:}

### Discrepancy: {cluster_id}.{assertion_index}

**Claim:** {full claim text}

**Verifier findings:**
- **Forward:** {verdict} — {value or note}
- **Reverse:** {verdict} — {value or note}
- **Cross:** {verdict} — {value or note}

**Value comparison:**
- Manifest states: {value from assertion}
- Forward found: {value}
- Reverse found: {value}
- Cross found: {value}

**Suggested resolution:** {If feedback pattern matched: prior resolution text. Otherwise: "No prior pattern — user resolution required."}

**User resolution:** {filled in after user decides}

{If no discrepancies: "No discrepancies found. All assertions confirmed by consensus."}

## Overall Verdict

**{PASS | FAIL}**

- Assertions checked: {total}
- Confirmed (3/3): {count}
- Confirmed (2/3, dissent noted): {count}
- Discrepancies: {count}
- Unverified: {count}

{If FAIL: "This report contains {N} discrepancies requiring resolution before the forensic findings can be trusted."}
{If PASS: "All forensic findings verified by independent consensus. The report is trustworthy."}

## Verifier Reports

- [Verifier-Forward](../verifier-reports/verifier-forward.md)
- [Verifier-Reverse](../verifier-reports/verifier-reverse.md)
- [Verifier-Cross](../verifier-reports/verifier-cross.md)
