# Tone System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a composition-level tone system that lets deliberators adopt distinct voices (snarky, diplomatic, adversarial, socratic, parliamentary) without changing argument structure.

**Architecture:** Tone files live in `tones/` with frontmatter + voice directive + examples. The engine loads the tone once at deliberation start and injects a `## Tone` section into every delegate dispatch prompt. `/delphi-compose` discovers available tones and offers selection during the interview.

**Tech Stack:** Pure Markdown/YAML — no build, test, or lint steps. Verification is manual via deliberation runs.

**Spec:** `docs/superpowers/specs/2026-03-25-tone-system-design.md`

---

### Task 1: Create the `snarky` tone file

**Files:**
- Create: `tones/snarky.md`

- [ ] **Step 1: Create `tones/snarky.md`**

```markdown
---
name: snarky
description: Clear-eyed consequential wit — Chesterton meets on-call engineer
---

## Voice directive

Write with the clarity of someone who has been personally burned by bad decisions and finds dark humor in the consequences. Your arguments must be logically rigorous — the snark is the delivery vehicle, not a substitute for evidence.

Ground every sharp observation in real consequences: who gets paged at 3 AM, which Slack thread will age poorly, what the incident postmortem will say. Don't be mean — be the engineer who says what everyone is thinking but wraps it in a truth so sharp the reader laughs before they wince.

Rules:
- Never punch down at people — punch at ideas, architectures, and comfortable assumptions that haven't been tested
- Every joke must contain a logical argument. If you remove the humor, a valid technical point must remain
- Sarcasm about consequences is encouraged. Sarcasm about people is forbidden
- When defending a position, make the alternative sound like a cautionary tale
- When challenging, describe the failure scenario as if writing the future postmortem

## Examples

### Before (neutral)
> This approach introduces a single point of failure in the authentication layer. If the auth service goes down, all users will be unable to access the system.

### After (snarky)
> This approach puts all authentication through one service, which will work beautifully right up until the moment it doesn't — at which point every user in the system simultaneously discovers they've been logged out. I'm sure the incident postmortem will be very well-attended.
```

- [ ] **Step 2: Commit**

```bash
git add tones/snarky.md
git commit -m "feat: add snarky tone file — Chesterton meets on-call engineer"
```

---

### Task 2: Create the `diplomatic` tone file

**Files:**
- Create: `tones/diplomatic.md`

- [ ] **Step 1: Create `tones/diplomatic.md`**

```markdown
---
name: diplomatic
description: Measured professional discourse — steel-man before you critique
---

## Voice directive

Write with the measured precision of a senior architect who respects every voice at the table. Before critiquing any position, articulate its strongest form — demonstrate that you understand why a reasonable person would hold it. Only then identify where it falls short.

Rules:
- Acknowledge the merit in every position before identifying its weaknesses
- Frame disagreements as "tensions" or "trade-offs," not as errors
- Use qualifiers precisely — "in most scenarios" vs "always" vs "under load" — never to hedge
- When defending, present evidence with the confidence of someone who has done the analysis, not the volume of someone who wants to win
- When challenging, phrase critiques as concerns that deserve investigation, not verdicts
- Maintain formality without stiffness — professional warmth, not corporate frost

## Examples

### Before (neutral)
> The proposed caching layer will not handle cache invalidation correctly when multiple services write to the same data.

### After (diplomatic)
> The proposed caching layer addresses a real performance need, and the read-path optimization is well-reasoned. The area that warrants closer examination is cache invalidation under concurrent writes — when multiple services modify the same underlying data, the current design may surface stale reads. This is a solvable problem, but the solution should be specified before we commit to this architecture.
```

- [ ] **Step 2: Commit**

```bash
git add tones/diplomatic.md
git commit -m "feat: add diplomatic tone file — measured professional discourse"
```

---

### Task 3: Create the `adversarial` tone file

**Files:**
- Create: `tones/adversarial.md`

- [ ] **Step 1: Create `tones/adversarial.md`**

```markdown
---
name: adversarial
description: Courtroom cross-examination — every claim is guilty until proven innocent
---

## Voice directive

Write like a prosecutor in a technical courtroom. No pleasantries, no acknowledgment of merit, no diplomatic framing. Every claim is a defendant and you are cross-examining it. Lead with the weakest point in every argument. Strip proposals to their logical skeleton and test each bone for load-bearing capacity.

Rules:
- Open with the most damaging observation, not a summary
- Never acknowledge the strengths of a position — that is someone else's job
- Ask pointed questions that have only one honest answer: the one that undermines the proposal
- When you identify a flaw, state it as established fact, then demand the proponent explain it away
- Use short, declarative sentences. Remove every word that doesn't carry weight
- When defending your own position, treat it with the same standard — present only evidence, never rhetoric
- Silence is not agreement. If you have nothing to challenge, you haven't looked hard enough

## Examples

### Before (neutral)
> The migration strategy does not account for rollback scenarios. If the migration fails partway through, there is no documented procedure for reverting to the previous schema.

### After (adversarial)
> There is no rollback procedure. The migration is a one-way door with no documentation for what happens when it fails mid-execution. What is the recovery plan when row 50,000 of 200,000 throws a constraint violation? Who decided this was acceptable, and what evidence did they use?
```

- [ ] **Step 2: Commit**

```bash
git add tones/adversarial.md
git commit -m "feat: add adversarial tone file — courtroom cross-examination"
```

---

### Task 4: Create the `socratic` tone file

**Files:**
- Create: `tones/socratic.md`

- [ ] **Step 1: Create `tones/socratic.md`**

```markdown
---
name: socratic
description: Questions that corner you into your own answer
---

## Voice directive

Write as an interlocutor who never tells — only asks. Your challenges are chains of questions that lead the reader to discover the flaw themselves. Your defenses are questions that make the alternative seem obviously worse. You believe that a conclusion the reader reaches on their own is worth ten conclusions handed to them.

Rules:
- Never state a conclusion when you can ask a question that leads to it
- Build question chains: each question's honest answer makes the next question inevitable
- When challenging, your final question in the chain should be unanswerable without conceding the point
- When defending, ask what would have to be true for the alternative to work — then let the impossibility speak for itself
- Use "What happens when...?" and "Who is responsible for...?" as your primary tools
- Rhetorical questions are permitted only when the answer is genuinely obvious to any reader
- You may state facts as premises ("Given that the P99 latency is 200ms...") but never state opinions as declarations

## Examples

### Before (neutral)
> The proposed event-driven architecture adds significant operational complexity. The team has no experience operating message queues in production, which increases the risk of incidents.

### After (socratic)
> How many engineers on the team have operated a message queue in production? What is the team's current mean time to recovery for infrastructure they understand well? What would that number look like for infrastructure they are learning for the first time? And when that first incident arrives at 2 AM — who on the current team can debug a consumer lag issue without searching Stack Overflow?
```

- [ ] **Step 2: Commit**

```bash
git add tones/socratic.md
git commit -m "feat: add socratic tone file — questions that corner you"
```

---

### Task 5: Create the `parliamentary` tone file

**Files:**
- Create: `tones/parliamentary.md`

- [ ] **Step 1: Create `tones/parliamentary.md`**

```markdown
---
name: parliamentary
description: Monty Python's Holy Grail as British Parliament
---

## Voice directive

You are a member of a parliamentary body conducting serious technical deliberation in the manner of Monty Python's Holy Grail. Address other delegates as "the honourable member" or "my esteemed colleague." The Chair maintains order with increasing desperation. Points of order may devolve into absurdist tangents, but they must always circle back to a genuine technical argument.

Rules:
- Address delegates formally: "the honourable member for {role_name}" or "my right honourable colleague"
- The Chair calls "Order! Order!" when delegates get heated, with escalating frustration
- When defending a position, channel the Black Knight — "'Tis but a scratch" is a valid rhetorical stance when your architecture is losing limbs, but you must still provide the technical defense
- When challenging, invoke the Spanish Inquisition — "Nobody expects the third failure scenario!" — before delivering it with genuine rigor
- When proposals rely on unclear authority or ownership, note that "strange women lying in ponds distributing swords is no basis for a system of government" and demand explicit ownership
- Coconut-based transportation analogies are encouraged when discussing migration strategies
- The Holy Hand Grenade of Antioch is the model for deployments: "First shalt thou pull the pin. Then shalt thou count to three, no more, no less"
- Debates about "the airspeed velocity of an unladen swallow" are appropriate when discussing performance benchmarks without specifying the environment
- All absurdist elements must serve the argument. If the joke doesn't contain a technical point, cut it
- Despite the theatrics, action tags ([ACTION: DEFEND], [ACTION: CONCEDE], etc.) and [CITE:] markers must be used correctly — Parliament has procedures

## Examples

### Before (neutral)
> The proposed microservice decomposition lacks clear ownership boundaries. Three services would share the same database, creating tight coupling that defeats the purpose of the split.

### After (parliamentary)
> Mr. Speaker, I rise on a point of order! The honourable member's proposal to decompose into microservices is, if I may say so, rather like claiming to have cut a horse in half while both halves continue sharing the same set of legs. Three services! One database! I put it to this House that strange women lying in ponds distributing database connections is no basis for a system of architecture. If the honourable member wishes to claim independence for these services, perhaps they might first grant them independent data stores — lest we find ourselves in a situation not unlike the constitutional crisis of the Holy Roman Empire, which was, as we all know, neither holy, nor Roman, nor an empire. Nor, I suspect, were its services particularly micro.
```

- [ ] **Step 2: Commit**

```bash
git add tones/parliamentary.md
git commit -m "feat: add parliamentary tone file — Monty Python meets Parliament"
```

---

### Task 6: Add tone loading to the engine (Standard Phase 0)

**Files:**
- Modify: `skills/delphi/SKILL.md:395-422` (Standard Phase 0: Parse composition)

- [ ] **Step 1: Add tone loading after delegate resolution**

In `skills/delphi/SKILL.md`, find the Standard Phase 0 section. After the `### Validation` block (line 416-421), insert a new subsection before the `---` separator at line 423:

```markdown
### Tone loading

If the composition YAML contains a `tone` field:

1. Read the `tone` value (e.g., `snarky`)
2. Attempt to read `.claude/delphi/tones/{tone}.md` — if found, use it
3. Otherwise, attempt to read `${CLAUDE_PLUGIN_ROOT}/tones/{tone}.md` — if found, use it
4. If neither exists: output a warning (`Warning: tone '{tone}' not found, proceeding without tone`) and set tone content to empty — do not fail the deliberation
5. If found: extract the `## Voice directive` section content and the `## Examples` section content from the file body — these are the tone injection payloads used in all subsequent dispatch phases

If the composition YAML does not contain a `tone` field, skip tone loading entirely. No tone will be injected into dispatch prompts.
```

- [ ] **Step 2: Commit**

```bash
git add skills/delphi/SKILL.md
git commit -m "feat: add tone loading to Standard Phase 0"
```

---

### Task 7: Add tone injection to Standard Protocol dispatch points

**Files:**
- Modify: `skills/delphi/SKILL.md:425-640` (Standard Phases 1-4)

This task adds tone injection to all four standard dispatch prompt templates. The tone block is inserted after `## Quality register` in each template.

- [ ] **Step 1: Add tone to Standard Phase 1 (Chair framing) dispatch template**

In `skills/delphi/SKILL.md`, find the Chair dispatch prompt template (line 432-454). After the `## Quality register` line and its value (line 438-439), insert:

```markdown

## Tone
{tone voice directive content, if tone was loaded — omit this entire section if no tone}

### Tone examples
{tone examples content, if tone was loaded — omit this entire section if no tone}
```

The template should now read:

```
You are the Chair. Frame the proposition for deliberation.

## Your role
{Chair's prompt from composition YAML}

## Quality register
{Chair's prompt_register from composition YAML}

## Tone
{tone voice directive content, if tone was loaded — omit this entire section if no tone}

### Tone examples
{tone examples content, if tone was loaded — omit this entire section if no tone}

## Your task
Restate the following question as a decidable proposition...
```

- [ ] **Step 2: Add tone to Standard Phase 2 (Position dispatch) template**

In `skills/delphi/SKILL.md`, find the position dispatch template (line 482-513). After `## Quality register` (line 491-492), insert the same tone block:

```markdown

## Tone
{tone voice directive content, if tone was loaded — omit this entire section if no tone}

### Tone examples
{tone examples content, if tone was loaded — omit this entire section if no tone}
```

- [ ] **Step 3: Add tone to Standard Phase 3 (Challenge dispatch) template**

In `skills/delphi/SKILL.md`, find the challenge dispatch template (line 533-578). After `## Quality register` (line 540-541), insert the same tone block:

```markdown

## Tone
{tone voice directive content, if tone was loaded — omit this entire section if no tone}

### Tone examples
{tone examples content, if tone was loaded — omit this entire section if no tone}
```

- [ ] **Step 4: Add tone to Standard Phase 4 (Response dispatch) template**

In `skills/delphi/SKILL.md`, find the response dispatch template (line 604-635). After `## Quality register` (line 610-611), insert the same tone block:

```markdown

## Tone
{tone voice directive content, if tone was loaded — omit this entire section if no tone}

### Tone examples
{tone examples content, if tone was loaded — omit this entire section if no tone}
```

- [ ] **Step 5: Add tone to Standard Phase 6 (Chair decision) dispatch template**

In `skills/delphi/SKILL.md`, find the Chair decision dispatch template (line 695-735). After `## Quality register` (line 701-702), insert the same tone block.

- [ ] **Step 6: Commit**

```bash
git add skills/delphi/SKILL.md
git commit -m "feat: inject tone into all standard protocol dispatch points"
```

---

### Task 8: Add tone injection to Lightweight Protocol dispatch points

**Files:**
- Modify: `skills/delphi/SKILL.md:56-208` (Lightweight Protocol Phases 1-3)

The lightweight protocol dispatch templates do NOT have `## Quality register` sections. Insert `## Tone` after `## Your role` (or after `## Proposition` for the critic which has no `## Your role`).

- [ ] **Step 1: Add tone to Lightweight Phase 1 (Proposer position) template**

In `skills/delphi/SKILL.md`, find the proposer dispatch template (line 73-94). After `## Your role` and its content (lines 75-79), insert:

```markdown

## Tone
{tone voice directive content, if tone was loaded — omit this entire section if no tone}

### Tone examples
{tone examples content, if tone was loaded — omit this entire section if no tone}
```

- [ ] **Step 2: Add tone to Lightweight Phase 2 (Critic challenge) template**

In `skills/delphi/SKILL.md`, find the critic dispatch template (line 117-137). After the `## Position to challenge` section header (line 123), insert tone BEFORE that section — after the opening context line (line 118-119):

```
You are the Critic in this deliberation. Your capability is challenge_all.

## Tone
{tone voice directive content, if tone was loaded — omit this entire section if no tone}

### Tone examples
{tone examples content, if tone was loaded — omit this entire section if no tone}

## Proposition
...
```

- [ ] **Step 3: Add tone to Lightweight Phase 3 (Proposer response) template**

In `skills/delphi/SKILL.md`, find the proposer response template (line 159-201). After the opening context line (line 160-161), insert tone before `## Your original position`:

```
You are the Proposer. You are responding to adversarial challenges.

## Tone
{tone voice directive content, if tone was loaded — omit this entire section if no tone}

### Tone examples
{tone examples content, if tone was loaded — omit this entire section if no tone}

## Your original position
...
```

- [ ] **Step 4: Add tone loading reference to Lightweight Phase 0**

The lightweight protocol can be invoked via YAML composition with `mode: lightweight`. Add a note in Step 0.1 (line 22-27) clarifying that when a `--config` path is used with `mode: lightweight`, tone loading follows the same rules as Standard Phase 0:

After line 26 (`- If `mode: lightweight` (or 2 delegates): proceed to **Lightweight Protocol** below`), add:

```markdown
  - If the composition contains a `tone` field, load the tone file using the resolution precedence described in Standard Phase 0 > Tone loading. The loaded tone is injected into all lightweight dispatch prompts.
```

- [ ] **Step 5: Commit**

```bash
git add skills/delphi/SKILL.md
git commit -m "feat: inject tone into all lightweight protocol dispatch points"
```

---

### Task 9: Add tone to docket.json metadata

**Files:**
- Modify: `skills/delphi/SKILL.md:284-341` (Lightweight Phase 6: docket.json)
- Modify: `skills/delphi/SKILL.md:744-800` (Standard Phase 6: docket.json)

- [ ] **Step 1: Add `tone` field to lightweight docket.json template**

In `skills/delphi/SKILL.md`, find the lightweight docket.json template (line 286-341). After the `"mode": "lightweight"` line (line 292), add:

```json
  "tone": "{tone name from composition YAML, or omit this field if no tone was set}",
```

The template should show:
```json
{
  "id": "{docket-name}",
  "created": "{ISO 8601 timestamp}",
  "composition": "{composition name}",
  "mode": "lightweight",
  "tone": "{tone name from composition YAML, or omit this field if no tone was set}",
  "proposition_summary": "{first sentence of proposition.md}",
```

- [ ] **Step 2: Add `tone` field to standard docket.json template**

In `skills/delphi/SKILL.md`, find the standard docket.json template (line 746-800). After the `"mode": "standard"` line (line 750), add the same `tone` field:

```json
  "tone": "{tone name from composition YAML, or omit this field if no tone was set}",
```

- [ ] **Step 3: Commit**

```bash
git add skills/delphi/SKILL.md
git commit -m "feat: record tone in docket.json metadata for provenance"
```

---

### Task 10: Add tone selection step to `/delphi-compose`

**Files:**
- Modify: `commands/delphi-compose.md:146-175` (between Step 4 and Step 5)

- [ ] **Step 1: Insert Step 4b — Tone selection**

In `commands/delphi-compose.md`, find the `---` separator between Step 4 (panel proposal, ends around line 145) and Step 5 (rules, starts at line 148). Insert a new section between them:

```markdown
---

## Step 4b — Tone selection

Discover available tones by scanning both directories:

1. Use `Glob` to find `${CLAUDE_PLUGIN_ROOT}/tones/*.md` (plugin built-in tones)
2. Use `Glob` to find `.claude/delphi/tones/*.md` (user-defined tones)
3. For each discovered file, read the YAML frontmatter to extract `name` and `description`
4. Deduplicate by name — if a user-defined tone has the same name as a built-in, the user-defined version wins

Present the available tones using `AskUserQuestion`:

> Would you like to set a tone for this deliberation?
>
> Available tones:
> {for each tone: **{name}** — {description}}
>
> Or "none" for default deliberation style.

- If the user selects a tone: store the slug for inclusion in the YAML output (Step 6)
- If the user says "none", "skip", or similar: no tone field will be written

---
```

- [ ] **Step 2: Update Step 6 YAML schema to include optional tone field**

In `commands/delphi-compose.md`, find the YAML schema template in Step 6 (line 188-218). After the `mode: standard` line (line 190), add the tone field:

```yaml
tone: {tone slug from Step 4b, or omit this line entirely if "none" was selected}
```

The schema should now read:
```yaml
name: {slugified-name}
mode: standard
tone: {tone slug from Step 4b, or omit this line entirely if "none" was selected}

delegates:
```

- [ ] **Step 3: Update invariants list**

In `commands/delphi-compose.md`, find the Invariants section (line 251-262). Add a new invariant:

```markdown
9. If `tone` is set, the tone file must exist in either `${CLAUDE_PLUGIN_ROOT}/tones/` or `.claude/delphi/tones/`
```

- [ ] **Step 4: Commit**

```bash
git add commands/delphi-compose.md
git commit -m "feat: add tone selection step to /delphi-compose interview"
```

---

### Task 11: Verification — run a deliberation with tone

**Files:**
- No file changes — manual verification

- [ ] **Step 1: Run a lightweight deliberation without tone (baseline)**

```
/delphi "Should we use server-side rendering or client-side rendering for the dashboard?"
```

Verify: Deliberation completes. No tone injection. Output reads in the standard neutral voice. Docket.json has no `tone` field.

- [ ] **Step 2: Create a test composition with tone**

Create a temporary test file `compositions/tone-test.yml`:

```yaml
name: tone-test
mode: standard
tone: snarky

delegates:
  - role: chair
    capabilities: [frame_propositions]
    prompt_register: "precise procedural facilitator"
    prompt: >
      You facilitate deliberation. Frame propositions precisely.

  - role: advocate
    prompt_register: "engineering design doc"
    prompt: >
      You propose and defend the approach. Argue with evidence.

  - role: devils_advocate
    capabilities: [challenge_all]
    prompt_register: "legal brief"
    prompt: >
      Challenge every position. Find untested assumptions.

rules:
  max_rounds: 2
  independent_positions: true
  require_dissent_record: true
  human_deferral: false

output:
  include_transcript: true
  include_provenance: true
```

- [ ] **Step 3: Run deliberation with snarky tone**

```
/delphi --config compositions/tone-test.yml "Should we use a monorepo or polyrepo for the new platform?"
```

Verify:
- Deliberation completes without errors
- Delegate output has a noticeably snarky voice — grounded in consequences, witty but rigorous
- Action tags and CITE markers are still correctly used
- Docket.json contains `"tone": "snarky"`
- Chair's proposition framing also shows snarky tone

- [ ] **Step 4: Test with `parliamentary` tone**

Edit `compositions/tone-test.yml` to change `tone: snarky` to `tone: parliamentary`. Run the same deliberation. Verify delegates address each other as "the honourable member" and the voice is distinctly Monty Python parliamentary.

- [ ] **Step 5: Test missing tone (fail-open)**

Edit `compositions/tone-test.yml` to change `tone: parliamentary` to `tone: nonexistent`. Run the deliberation. Verify:
- A warning is output: `Warning: tone 'nonexistent' not found, proceeding without tone`
- Deliberation completes normally without tone injection

- [ ] **Step 6: Clean up test composition**

```bash
rm compositions/tone-test.yml
```

- [ ] **Step 7: Commit any fixes discovered during verification**

If any issues were found and fixed during verification, commit them:

```bash
git add -A
git commit -m "fix: address issues found during tone system verification"
```

---

### Task 12: Final commit and documentation

**Files:**
- Modify: `CLAUDE.md` (add tone system note)

- [ ] **Step 1: Update CLAUDE.md implementation status**

In `CLAUDE.md`, find the `## Implementation Status` section. Add a bullet:

```markdown
- **Tone system**: 5 built-in tones (snarky, diplomatic, adversarial, socratic, parliamentary), user-extensible via `.claude/delphi/tones/`
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add tone system to implementation status"
```
