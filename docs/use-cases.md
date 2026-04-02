# When to Use /delphi

The core mechanic is **forcing structured disagreement before commitment**. Any time you'd want a second opinion from a senior colleague before committing, that's a deliberation.

---

## Decisions Under Uncertainty

### Architecture & design

The obvious use case. Any "X vs Y" decision where both options have real trade-offs.

```
/delphi "Should we use event sourcing or CRUD for the order pipeline?"
/delphi "Monolith or microservices for the notification system?"
/delphi "Which state management approach for the dashboard — Redux, Zustand, or server state only?"
```

### Trade-off decisions with no clear winner

When you're weighing competing concerns and there's no objectively correct answer.

```
/delphi "Should we optimize the query for read performance at the cost of write complexity?"
/delphi "Ship the feature with known tech debt or delay two weeks to build it right?"
/delphi "Build our own rate limiter or integrate a third-party service?"
```

### Irreversible or expensive-to-reverse choices

Decisions where getting it wrong costs weeks of rework. Deliberation is cheap; migration is not.

```
/delphi --config compositions/integration-review.yml --input schema.sql "Is this database schema correct before we run the migration?"
/delphi "Should the API use REST or GraphQL? We'll have external consumers within a month."
/delphi "JWT with refresh tokens or server-side sessions for our auth strategy?"
```

---

## Code Quality & Risk

### Pre-merge adversarial review

Not "is this code correct" but "is this *approach* correct." Catches what a normal code review misses.

```
/delphi --input pr-diff.md "Is the approach in this PR sound, or are we building on a bad foundation?"
```

### Incident post-mortem analysis

Forces a critic to ask: are you fixing the symptom or the disease?

```
/delphi "Adding a retry with exponential backoff is the correct fix for these intermittent 503s"
/delphi --input incident-report.md "Our proposed remediation addresses the root cause, not just the trigger"
```

### Security-sensitive changes

Veto mechanics are designed for this — a security-focused delegate can veto invariant violations.

```
/delphi --config compositions/integration-review.yml --input auth-flow.md "This new OAuth flow is secure for our threat model"
/delphi "Storing API keys in environment variables is sufficient for our deployment model"
```

---

## Debugging

Normal debugging is **serial hypothesis testing** — you try one theory, check, try another. That's slow and anchored to your first guess. Deliberation forces **parallel adversarial hypothesis testing**: the proposer argues for your theory while the critic simultaneously argues for alternatives.

### "I think the bug is X"

The proposer builds the case for your hypothesis. The critic manufactures alternative explanations you haven't considered.

```
/delphi "The timeout errors are caused by connection pool exhaustion, not the upstream API"
/delphi "The memory leak is in the event listener cleanup, not the cache layer"
```

### Root cause vs. symptom

You found a fix that works. But is it the root cause?

```
/delphi "Adding a retry with backoff is the correct fix for these intermittent 503s"
/delphi "The null pointer exception is caused by the race condition in the init sequence, not missing validation"
```

### Standard mode with grounding files

Point delegates at your logs, error traces, and metrics for evidence-based debugging.

```
/delphi --config compositions/integration-review.yml --input error-log.txt --input metrics-dashboard.md "The root cause of the payment processing failures is the database connection timeout, not the third-party payment gateway"
```

A domain architect delegate can veto a fix that violates invariants. An integration realist can manufacture the failure scenario your fix doesn't cover.

### "It works on my machine"

Forces someone to argue your fix has gaps.

```
/delphi "This race condition only manifests under high concurrency and our fix of adding a mutex is sufficient"
/delphi "The flaky test is caused by test isolation, not a real bug in the code"
```

### Why deliberation improves debugging

The `[CITE:]` requirement is key. When the proposer says "the fix is correct," the engine requires them to cite evidence. `DEFEND` without `CITE` = contested. This forces evidence-based debugging instead of vibes-based debugging.

You get:
- Alternative root causes you hadn't considered
- Failure scenarios your fix doesn't cover
- Evidence gaps in your reasoning ("you say it's the connection pool, but where's the metric showing pool exhaustion?")

---

## Planning & Strategy

### Sprint/milestone planning

Forces someone to argue *against* the popular item.

```
/delphi "We should prioritize the search feature over the notification system for this sprint"
/delphi --input backlog.md "This is the correct priority order for the next 3 weeks"
```

### Migration strategy

Big-bang vs. strangler fig vs. parallel-run — each approach has real trade-offs.

```
/delphi "We should use the strangler fig pattern to migrate from the legacy API"
/delphi "Migrating the database in a single cutover is less risky than running dual-write for 6 weeks"
```

### Dependency decisions

Should you adopt, upgrade, or replace?

```
/delphi "We should upgrade to Next.js 16 now rather than waiting for the ecosystem to stabilize"
/delphi "We should replace the abandoned logging library now rather than after the next incident"
```

---

## Writing & Communication

### RFC/design doc review

Write the RFC, then have it adversarially reviewed before your colleagues see it.

```
/delphi --config compositions/integration-review.yml --input rfc.md "This RFC is ready for team review"
```

The critic finds what your colleagues will find in review — before they see it.

### Documentation accuracy

Catches when docs have drifted from implementation.

```
/delphi --input architecture.md "This architecture document accurately reflects the current system"
```

### Contract/spec review

API contracts, integration specs, SLAs.

```
/delphi --input api-contract.md "This API contract protects us in the failure scenarios we care about"
/delphi --input sla.md "Our SLA commitments are achievable given our current infrastructure"
```

---

## Choosing the Right Mode

### Use lightweight (`/delphi`) for everyday decisions

Quick, 2-delegate deliberations that take seconds and catch the thing you'd realize in the shower later.

```
/delphi "Should I extract this into a shared utility or keep it inline?"
/delphi "Is this the right abstraction boundary?"
/delphi "Should this validation live client-side or server-side?"
/delphi "Is this error handling strategy sufficient?"
```

### Use standard (`/delphi --config`) for multi-dimensional decisions

Decisions with multiple stakeholders, dimensions, or where one dimension can veto.

- Compositions with **domain-specific delegates** (DBA perspective, frontend perspective, ops perspective)
- Decisions where **one dimension can veto** (security, compliance, domain invariants)
- Decisions where **human deferral** matters — the plugin produces a structured deferral package instead of forcing a bad answer

### Use code review (`/delphi-review`) for code quality

When you want adversarial assessment of code — not "does it compile" but "is the approach sound, will it scale, does it follow the design system."

- Pre-merge review of files or diffs
- Convention compliance when you have a rules document
- Maintainability assessment from the perspective of the next developer

### Use forensic verification (`/delphi-audit`) for fact-checking

When an investigation report makes factual claims about values in source files and you need to confirm those claims are ground truth before acting on them.

- Payroll audit findings before reporting to stakeholders
- Any forensic investigation where a model read files and reported values
- Zero-tolerance domains where a single incorrect value has real consequences

---

## Code Review

### Adversarial code review

Not a linter — `/delphi-review` catches the things linters can't: wrong abstractions, maintainability traps, design system misuse, and architectural patterns that will cause pain six months from now.

```
/delphi-review src/components/Dashboard.tsx
/delphi-review src/components/*.tsx --conventions RULES.md
/delphi-review --diff HEAD~3
```

Three distinct perspectives examine the same code independently:
- **Advocate** defends the implementation choices
- **Critic** attacks the weakest patterns
- **Maintainer** reads it as someone inheriting the codebase cold

The output is a prioritized remediation plan, not a list of opinions.

### Design system compliance

When you have a conventions document, the Enforcer audits every component usage against it.

```
/delphi-review --conventions .docs/antd-v6-conventions.md src/components/*.tsx
```

---

## Forensic Verification

### Verifying audit findings

When an investigation produces a report claiming "employee 53310 had premium $42.38 in the 02.06 file," did the model actually read that correctly, or did it hallucinate? `/delphi-audit` dispatches three independent verifiers to read the source files and confirm every factual claim.

```
/delphi-audit docs/investigations/2026-04-01-WholeLifeAudit-Findings.yaml
```

Three different verification strategies attack the same claims:

- **Forward** reads the cited files and checks that values match
- **Reverse** follows the `falsifiable_by` instructions and actively tries to disprove each claim
- **Cross** checks values across all evidence files — not just the ones the audit cited — looking for gaps and inconsistencies

### Zero-tolerance domains

Forensic verification is designed for domains where factual accuracy is non-negotiable — payroll, compliance, financial audits, regulatory filings. A single hallucinated value can mean someone's paycheck is wrong.

The consensus model is simple: if all three verifiers agree, the claim is confirmed. Any disagreement is escalated to the user — the engine never resolves factual disputes on its own.

### Learning from discrepancies

When discrepancies are resolved, the resolution is persisted to a feedback log. The next time a similar discrepancy appears, the engine suggests the prior resolution: "Last 4 times this pattern appeared, it was a manual reprocessing run outside the pipeline."

Over time, the feedback log reveals which verification strategies catch the most real errors and which claim types have the highest discrepancy rates.

---

## When NOT to Use It

- The answer is obvious and everyone agrees
- You're bikeshedding (naming, formatting, style)
- The decision is trivially reversible
- You need speed more than rigor (hotfix in production)

**The heuristic:** if you'd want a second opinion from a senior colleague before committing, that's a deliberation.
