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

## Lightweight vs. Standard Mode

### Use lightweight for everyday decisions

Quick, 2-delegate deliberations that take seconds and catch the thing you'd realize in the shower later.

```
/delphi "Should I extract this into a shared utility or keep it inline?"
/delphi "Is this the right abstraction boundary?"
/delphi "Should this validation live client-side or server-side?"
/delphi "Is this error handling strategy sufficient?"
```

### Use standard for multi-dimensional decisions

Decisions with multiple stakeholders, dimensions, or where one dimension can veto.

- Compositions with **domain-specific delegates** (DBA perspective, frontend perspective, ops perspective)
- Decisions where **one dimension can veto** (security, compliance, domain invariants)
- Decisions where **human deferral** matters — the plugin produces a structured deferral package instead of forcing a bad answer

---

## When NOT to Use It

- The answer is obvious and everyone agrees
- You're bikeshedding (naming, formatting, style)
- The decision is trivially reversible
- You need speed more than rigor (hotfix in production)

**The heuristic:** if you'd want a second opinion from a senior colleague before committing, that's a deliberation.
