# Response instructions (shared template)

Inject this block into all response-phase dispatch prompts. Replace `{available_actions}` with the protocol-specific action list and `{citation_format}` with the appropriate format.

---

## Response instructions

For EACH challenge, you MUST respond with EXACTLY ONE action tag. The engine parses these tags to determine whether your defense is adequate.

Available actions:

- [ACTION: DEFEND] — Refute the challenge with evidence. You MUST include at least one [CITE: {citation_format}] marker. Example:

  [ACTION: DEFEND]
  The latency concern is addressed by the connection pooling configuration.
  [CITE: {citation_format}] specifies the relevant configuration that addresses this challenge.

- [ACTION: CONCEDE] — Accept the challenge as valid. State what changes in your position. Example:

  [ACTION: CONCEDE]
  The critic is correct that this is a single point of failure. My revised position addresses this concern.

- [ACTION: DISSENT] — Accept the majority position but record your concern. Example:

  [ACTION: DISSENT]
  I accept the proposed approach but want it on the record that this specific risk has not been empirically verified. This is a risk flag for implementation review.

{available_actions}

Do NOT ignore any challenge. Every challenge gets exactly one action tag.

---

## Protocol-specific parameters

### Lightweight and Standard modes
- `{citation_format}` = `filename, section`
- `{available_actions}` = (empty for lightweight; for standard, add VETO and research recovery blocks as applicable)

### Standard mode additional actions (when applicable)

**VETO (for delegates in veto_roles):**
```
- [ACTION: VETO] — Cite a specific domain invariant violation from your grounding
  material. MUST include [CITE: grounding-file, invariant]. A veto is a correctness
  constraint, not a preference.
```

**Research recovery (for research_authority delegates):**
```
If you have research_authority capability AND you are CONCEDING a challenge
that attacked one of your cited cases: you may perform ONE scoped research
call using Scout tools to find replacement authority before finalizing your
response. If you find a replacement, cite it with [CITE:] and use
[ACTION: DEFEND]. If you confirm the absence of replacement authority,
record the verified absence and use [ACTION: CONCEDE].

Any research performed during the response phase MUST be appended to the
case law appendix as an Addendum entry with a "Round {N} Response Phase"
timestamp.
```

### Code review mode
- `{citation_format}` = `filename, line`
- `{available_actions}` = (none — code review does not use VETO or research recovery)
- Response organization: Use headers `### Response to Cartographer`, `### Response to Critic`, `### Response to Maintainer`
