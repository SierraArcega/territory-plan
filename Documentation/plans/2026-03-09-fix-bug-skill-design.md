# Fix Bug Skill — Design

## Trigger

User verbally reports a bug (e.g., "the map filter isn't clearing properly").

## Flow

### Phase 1: Intake

Ask these questions one at a time:

1. **What's the bug?** — Description of the unexpected behavior
2. **What's the expected behavior?** — What should happen instead
3. **How to reproduce?** — Steps to trigger it
4. **When did it start?** — Recent change, always been there, unknown
5. **Any error messages?** — Console errors, stack traces, logs
6. **Severity** — Blocking, major, or minor

### Phase 2: Ticket Creation

Invoke `create-ticket` skill using intake answers to populate the Jira ticket summary and description.

### Phase 3: Branch Setup

- Branch format: `bugfix/MAPO-{id}-{slug}`
  - `{id}` = numeric part of ticket key (e.g., `42` from `MAPO-42`)
  - `{slug}` = ticket summary lowercased, spaces to hyphens, non-alphanumeric removed, truncated ~50 chars on word boundary
- Git steps: stash if dirty, checkout main, pull, create branch

### Phase 4: Jira Housekeeping

- Transition ticket to In Progress
- Assign to current user
- Invoke `apply-template` to audit ticket against lifecycle template

### Phase 5: Debug

Invoke `systematic-debugging` to begin root cause investigation using intake findings as context.

## Integration with Existing Skills

| Skill | Role in Flow |
|-------|-------------|
| `create-ticket` | Phase 2 — creates the Jira ticket |
| `apply-template` | Phase 4 — audits ticket template compliance |
| `systematic-debugging` | Phase 5 — root cause investigation |

Does NOT use `work-on-ticket` — handles branch creation and Jira transitions directly because:
- Ticket is created mid-flow (work-on-ticket expects existing ticket)
- Branch naming convention differs (`bugfix/` vs `MAPO/`)

## Naming

- Skill name: `fix-bug`
- Branch prefix: `bugfix/`
