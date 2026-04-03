# Feature Spec: Engage — Email Sequencer

**Date:** 2026-04-03
**Slug:** engage-email-sequencer
**Status:** Draft

## Overview

Engage is a new top-level tab in the territory planning app that gives sales reps a multi-channel sequence execution tool. Users create reusable sequences of steps (email, phone call, text, LinkedIn), load contacts from their territory plan, and step through each action one-by-one with full editing control before sending. Every completed step is automatically logged as an Activity for the contact and district.

V1 focuses on email sending via the existing Gmail integration, with phone/text/LinkedIn as manual action prompts. The data model supports all channel types from day one.

## Requirements

### Who uses it
Any user — reps and managers alike. No role-based permissions on template or sequence creation. Everyone can create, edit, and execute.

### Core workflow
1. User creates a **Sequence** — an ordered list of steps
2. For each step, user either writes content inline (subject + body) OR picks from a pre-existing **Template**. Templates are optional — a user can build an entire sequence from scratch without ever visiting the Templates tab.
3. User hits "Run Sequence," selects contacts from territory plan districts (or adds manually), fills any custom merge fields
4. System resolves merge fields and creates a **StepExecution** per contact per step
5. User steps through one email at a time in a full editor — content is pre-filled but fully editable
6. On "Send & Next," the email sends via Gmail, an Activity is created, and the next email loads
7. Non-email steps (call, text, LinkedIn) show as action prompts with notes fields
8. User can pause and resume from the Active Runs tab at any time

### Contact sourcing
- Primary: select contacts from territory plan / district associations
- Secondary: manual entry of email addresses for one-off recipients

### Merge fields
- **System fields** auto-resolve from database: contact (first_name, last_name, full_name, title, email), district (name, state, city, enrollment, leaid), financial (pipeline, bookings, invoicing, sessions_revenue), sender (my_name, my_email, my_title), date (today, current_month, current_year)
- **Custom fields** defined per-sequence by any user, filled manually per-contact before execution
- Syntax: `{{field_name}}` in template body and subject
- Unresolved fields are highlighted in the editor — warn before send if any remain

### Success criteria
- Full execution flow: template selection → contact loading → merge field resolution → one-by-one review/edit → send via Gmail → auto-advance
- Template CRUD for all users
- Send history with per-execution detail views
- Analytics: sent/skipped counts from StepExecution status; open/click columns present but populated via Mixmax enrichment or future Gmail extension (no tracking pixels in v1)

## Architecture

### Approach: Sequence-First

Design-time entities (Sequence, SequenceStep, Template) are reusable blueprints. Run-time entities (SequenceExecution, StepExecution) are created per execution. This separation enables:
- Clean analytics aggregation by sequence, step, or contact
- Multi-channel step types as first-class citizens
- Future scheduling/drip logic via the `delayDays` field
- Template reuse across sequences with live references

### Content flow

Steps can source content in two ways:

```
Option A: Template-based step          Option B: Inline step
─────────────────────────              ─────────────────────
Template (live, editable)              SequenceStep.body + subject
    ↓ referenced by                        ↓ directly used
SequenceStep (templateId)              SequenceStep (templateId = null)
    ↓ on execution launch                 ↓ on execution launch
StepExecution (sentBody = resolved)    StepExecution (sentBody = resolved)
    ↓ on completion                       ↓ on completion
Activity (linked to contact+district)  Activity (linked to contact+district)
```

- **Template-based steps:** editing the template updates all sequences that reference it (for future runs)
- **Inline steps:** content lives directly on the step and is edited in the sequence editor
- In both cases, once execution launches, StepExecution content is resolved and independent of the source
- User edits during execution only affect that one contact's send

## Data Model

### Template (new)

| Field | Type | Description |
|-------|------|-------------|
| id | int, PK | Auto-increment |
| name | string | Display name |
| type | enum: email, call, text, linkedin | Determines which editor UI to show |
| subject | string, nullable | Email subject line (email type only) |
| body | text | Content with `{{merge}}` placeholders |
| createdByUserId | FK → UserProfile | Creator |
| isArchived | boolean, default: false | Soft delete |
| createdAt | datetime | |
| updatedAt | datetime | |

### Sequence (new)

| Field | Type | Description |
|-------|------|-------------|
| id | int, PK | Auto-increment |
| name | string | Display name |
| description | string, nullable | Optional description |
| createdByUserId | FK → UserProfile | Creator |
| isArchived | boolean, default: false | Soft delete |
| createdAt | datetime | |
| updatedAt | datetime | |

Relations: `steps: SequenceStep[]`, `executions: SequenceExecution[]`, `mergeFieldDefs: MergeFieldDefinition[]`

### SequenceStep (new)

| Field | Type | Description |
|-------|------|-------------|
| id | int, PK | Auto-increment |
| sequenceId | FK → Sequence | Parent sequence |
| templateId | FK → Template, nullable | Optional — live reference to a pre-existing template |
| type | enum: email, call, text, linkedin | Step channel type (required whether using template or inline) |
| subject | string, nullable | Inline subject (email only). Ignored if templateId is set. |
| body | text, nullable | Inline content with `{{merge}}` placeholders. Ignored if templateId is set. |
| position | int | Step ordering |
| delayDays | int, default: 0 | Future: days to wait before this step (ignored in v1) |
| metadata | JSON, nullable | Channel-specific config |
| createdAt | datetime | |
| updatedAt | datetime | |

Content resolution: if `templateId` is set, content comes from the referenced Template (live). If `templateId` is null, content comes from the step's own `subject` and `body` fields. A step must have one or the other — validated on save.

Unique constraint: `(sequenceId, position)`

### SequenceExecution (new)

| Field | Type | Description |
|-------|------|-------------|
| id | int, PK | Auto-increment |
| sequenceId | FK → Sequence | Which sequence is being run |
| userId | FK → UserProfile | Who is running it |
| status | enum: active, paused, completed, cancelled | Execution state |
| currentStepPosition | int | Current step position (1-indexed, matches SequenceStep.position) |
| currentContactIndex | int | Current contact index within the current step (0-indexed) |
| contactCount | int | Total contacts in this run |
| completedCount | int | Steps completed so far |
| startedAt | datetime | |
| completedAt | datetime, nullable | |
| createdAt | datetime | |
| updatedAt | datetime | |

### StepExecution (new)

| Field | Type | Description |
|-------|------|-------------|
| id | int, PK | Auto-increment |
| executionId | FK → SequenceExecution | Parent execution |
| stepId | FK → SequenceStep | Which step this is for |
| contactId | FK → Contact | Target contact |
| status | enum: pending, completed, skipped, failed | Step status |
| sentBody | text | Resolved content after merge + user edits — what was actually sent |
| sentSubject | string, nullable | Resolved subject (email only) |
| gmailMessageId | string, nullable | Links to Gmail for email steps |
| activityId | FK → Activity, nullable | Activity created on completion |
| notes | text, nullable | For call/manual steps |
| completedAt | datetime, nullable | |
| createdAt | datetime | |
| updatedAt | datetime | |

### MergeFieldDefinition (new)

| Field | Type | Description |
|-------|------|-------------|
| id | int, PK | Auto-increment |
| sequenceId | FK → Sequence | Parent sequence |
| name | string | Field key used in templates, e.g. "talking_point" |
| label | string | Display label, e.g. "Talking Point" |
| type | enum: system, custom | System fields auto-resolve; custom fields are manual |
| sourceField | string, nullable | For system fields: dotted path e.g. "contact.first_name" |
| defaultValue | string, nullable | Fallback if field can't be resolved |
| createdAt | datetime | |

### Activity integration

On every step completion, create an Activity record:

| Step type | Activity.type | Activity.source | Additional fields |
|-----------|--------------|-----------------|-------------------|
| email | "email_sent" | "engage" | gmailMessageId, subject as title |
| call | "call" | "engage" | notes as description |
| text | "text_sent" | "engage" | (future) |
| linkedin | "linkedin_message" | "engage" | (future) |

Activity is linked to contact and district via existing ActivityContact and ActivityDistrict junction tables. StepExecution.activityId back-links to the Activity for bidirectional tracing.

## UI Design

### Navigation

New top-level sidebar tab: **Engage** (TabId: `"engage"`). Four sub-tabs:

1. **Sequences** — library of all sequences (card grid/list, create/edit/archive/duplicate)
2. **Active Runs** — in-progress executions with progress indicators and resume action (badge count in tab header)
3. **Templates** — template CRUD (name, type, subject, body with merge field editor)
4. **History** — completed/cancelled runs with analytics

### Sequence editor

Accessed from Sequences tab via "New Sequence" or clicking an existing sequence.

- Header: sequence name + description fields, Save and Archive buttons
- **Steps list:** ordered cards, each showing step type icon + template name (or "Custom" for inline) + subject preview. Drag-to-reorder via handle. Overflow menu (edit, remove, duplicate). "+ Add Step" button offers: choose an existing template OR write new content inline. Inline steps open a subject + body editor directly in the sequence editor.
- **Merge fields section:** lists auto-detected system fields from referenced templates. "+ Add Custom Field" for user-defined fields with name, label, and optional default value.
- **"Save as Template"** option on inline steps — lets users promote an inline step's content to a reusable template without leaving the sequence editor.
- **"Run Sequence →"** button at bottom opens the contact selector.

### Template editor

Accessed from Templates tab via "New Template" or clicking an existing template.

- Template name field
- Type selector (email, call, text, LinkedIn)
- For email: subject field + rich text body editor
- For call: talking points / notes template body
- For text/LinkedIn: message body
- Merge field insertion toolbar — click to insert `{{field}}` at cursor position
- Preview pane showing resolved example with sample data

### Execution flow

**Contact selector** (opens on "Run Sequence →"):
- Search/select contacts from territory plan districts
- Manual add option for one-off recipients
- Custom merge field columns shown per-contact for manual fill
- Warning icons on contacts missing email (for email steps)
- Review screen with merge field preview before launch

**Step-through panel** (the core send experience):
- Header: sequence name, current step label (e.g. "Step 1 of 3: Email"), contact progress (e.g. "8 of 30")
- For email steps: To field (read-only), subject field (editable), rich text body editor (pre-filled with resolved template, fully editable)
- Merge field reference: collapsible section showing which fields were resolved and their values
- For call steps: contact info + phone, talking points, notes text area
- For text/LinkedIn steps: contact info, message prompt, completion checkbox
- Actions: "Skip" (marks as skipped, advances) and "Send & Next" / "Complete & Next"
- Progress indicator: dots or bar showing position in current step's contact list

**Pause/resume:** closing the panel or navigating away auto-pauses. Execution state is server-side. Resume from Active Runs tab.

### History & analytics

**List view:** filterable table of all executions. Columns: sequence name, contact count, sent, opened, clicked, status, date. Filter by sequence and date range. CSV export.

**Detail view:** click into a run to see:
- Summary stats: sent, opened (%), clicked (%), skipped counts
- Per-step breakdown: each step's stats
- Per-contact grid: contact × step matrix showing status icons (sent, opened, clicked, skipped, call completed). Click any cell to view actual sent content or call notes.

**Analytics data sources:**
- Sent/skipped/completed counts: from StepExecution status (available in v1)
- Open/click tracking: columns present, populated via Mixmax enrichment or future Gmail extension. No tracking pixels or link wrapping in v1.

**Analytics surfaces:**
- Engage → History tab (primary)
- District detail panel: Engage actions appear in activity timeline with "engage" source badge
- Sequence cards: aggregate stats (total runs, contacts reached)

## States

### Empty states
- **Sequences tab:** "Create your first sequence" CTA with brief explanation
- **Templates tab:** "Create reusable email templates with merge fields" CTA, show available merge fields as teaser
- **Active Runs:** "No active runs. Start a sequence from the Sequences tab."
- **History:** "Your completed runs will appear here with analytics."

### Loading states
- Sequence/template lists: skeleton cards
- Execution launch: "Preparing emails..." spinner during merge field resolution
- Sending email: "Send & Next" button shows spinner, disabled to prevent double-send
- History table: skeleton rows
- Analytics stats: shimmer on numbers while computing

### Error states

**Gmail not connected:** block execution launch for sequences with email steps. Inline banner: "Connect your Gmail account to send emails" with link to Profile → Integrations. Non-email steps can still execute.

**Gmail token expired mid-execution:** auto-pause execution. Show: "Your Gmail connection needs to be refreshed." Reconnect button. Execution resumes from where it left off — no data loss, no duplicate sends (StepExecution status prevents re-sending).

**Gmail send failure (single email):** mark StepExecution as `failed`. Inline error: "Failed to send to [email] — [reason]." Offer Retry or Skip & Next. Don't block entire run.

**Unresolved merge fields:** highlight in editor with yellow background on `{{tag}}` placeholders. Warn before send if any unresolved tags remain. User can manually fill or skip.

**Contact missing email:** flag in contact selector with warning icon. Auto-skip email steps during execution (mark as `skipped` with reason). Call/LinkedIn steps still execute.

### Edge cases

**Template deleted while in use:** soft-delete via `isArchived`. Steps referencing archived templates show warning: "This template has been archived." Content still readable — user can run the sequence or swap the template.

**Template recently modified:** when a sequence references a template with `updatedAt` within the last 7 days, show a one-time dismissable info banner: "Template '[name]' was updated [X days ago / today]. Review step [N] to make sure the latest content looks right." Dismiss stored in localStorage keyed by `templateId + updatedAt`. Also surfaces at execution launch. Multiple changed templates stack warnings.

**Same contact in multiple active runs:** allowed. Each creates its own Activity records. Contact selector shows subtle indicator if contact is already in an active run, but doesn't block.

**Browser closed mid-execution:** execution state is server-side. Resume from Active Runs tab exactly where user left off.

**Template edited during active run:** no effect on already-resolved StepExecution content. Only new executions pick up changes.

## Out of Scope (v1)

- **Multi-step scheduling / drip delays:** `delayDays` field exists in the model but is ignored. All steps execute immediately in sequence.
- **Bulk batch sending:** no "send all remaining" button. One-by-one review only.
- **Gmail extension compatibility:** data model supports it but no extension is built.
- **Tracking pixels / link wrapping:** open/click columns exist but are populated by external enrichment only.
- **SMS integration (Twilio etc.):** text steps are manual action prompts.
- **LinkedIn API integration:** LinkedIn steps are manual action prompts.
- **Team-wide template permissions:** no shared vs private distinction. All templates visible to all users.
- **A/B testing:** no variant support on templates.
- **Sequence branching / conditional logic:** linear step order only.
