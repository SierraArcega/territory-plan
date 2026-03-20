# How to Work with Claude on This Codebase

A guide for getting good results when asking Claude to make changes
to the Territory Plan Builder. You don't need to know how to code —
just how to describe what you want clearly.

## Quick Start

1. Open Claude Code in the `territory-plan` directory
2. Describe what you want in plain language
3. Claude will figure out where to make changes

The more specific you are about WHAT you want (not WHERE in the code),
the better results you'll get.

## Examples

### Building a New Feature

> I want to add a "win/loss reason" tracker to plans. When a sales rep
> closes a deal (won or lost), they should be able to select a reason
> from a dropdown — things like "price", "competitor", "timing",
> "relationship". I want to see these aggregated on the progress
> dashboard (where the Leading and Lagging Indicators are) so we can
> spot trends across the team.

Why this works: it describes the user-facing behavior (dropdown on
close), the data it captures (reason categories), and where the
output should appear (the progress dashboard — Claude knows this
means `src/features/progress/`). Claude will ask follow-up questions
about the specific reason categories, whether reasons differ for
wins vs losses, etc.

Start this kind of request with `/new-feature` so Claude walks you
through design before building.

### Improving an Existing Feature

> In the district detail panel (the sidebar that opens when you click
> a district on the map), enrollment is shown as just a number. I'd
> like it to also show year-over-year change — something like
> "12,450 (+3.2%)" — so I can quickly see if a district is growing or
> shrinking. The enrollment data from prior years is already in the
> districts table.

Why this works: it identifies the exact UI location (district detail
panel — Claude knows this is in
`src/features/map/components/panels/district/`), what exists now
("just a number"), what should change ("year-over-year"), gives a
visual example of the format, and confirms the data source (the
`districts` table). Claude can go straight to the right component
without guessing.

### Fixing a Bug

> When I open the explore grid (the spreadsheet overlay on the map)
> and sort by Pipeline descending, districts with no pipeline show up
> at the top instead of the bottom. They should be sorted to the
> bottom — nulls last. This happens for the Bookings and Invoicing
> columns too.

Why this works: it describes the exact steps to reproduce (open
explore grid, sort by Pipeline descending), what goes wrong (nulls
at top), what should happen instead (nulls at bottom), and uses
the actual metric names (Pipeline, Bookings, Invoicing) that appear
in the summary bar and explore grid. Claude can find the sorting
logic and fix all three at once.

### Exploring a New Idea

> I've been thinking about adding an "ICP score" (ideal customer
> profile) to each district — a number from 0-100 that combines
> enrollment size, expenditure per pupil, FY26 open pipeline, and
> geographic proximity to existing customers (is_customer districts).
> I don't want to build it yet — I want to brainstorm what factors
> should go into the score and how we'd weight them. Can you look
> at what data we already have on the districts table that could
> feed into this?

Why this works: it clearly separates exploration from implementation
("I don't want to build it yet"), uses actual field names the user
has seen in the app (enrollment, expenditure per pupil, FY26 open
pipeline, is_customer), and asks Claude to ground the brainstorm in
the real schema. Claude will read `prisma/schema.prisma`, identify
available fields, and help think through the scoring model.

### Querying the Database for Information

> Can you write me a SQL query that shows the top 20 districts by
> fy26_open_pipeline value, but only districts in Texas
> (state_abbrev = 'TX') that aren't already customers
> (is_customer = false)? I want to see name, enrollment,
> fy26_open_pipeline, and sales_executive.

Why this works: it specifies exact column names from the districts
table, filters, sort order, and fiscal year. Claude knows the Prisma
schema and can write a query that runs directly against PostgreSQL.
You can also ask broader questions like "how many districts assigned
to Sarah have no activities logged this quarter?" and Claude will
figure out the right tables and joins (districts -> district_edits
for ownership, activities for activity logging).

**Note:** Claude can write and explain queries but won't run them
against your database unless you explicitly ask. It's safe to ask
for query drafts to run yourself.

## Prompt Templates by Task

### "I want to change how something looks"
> "Change the district detail panel so the enrollment number is bigger
>  and more prominent"
>
> "Make the pipeline column in the explore grid show red when the value
>  is zero"
>
> "Add a border between the sections in the plan detail view"

**Tips:** Describe what you see now, what's wrong, and what you want
instead. Use the words you'd use to describe it to a coworker —
"the sidebar", "the map", "the data table", "the plan card".

### "I want to add something new"
> "Add a notes field to the plan detail view where I can type free-form
>  notes about the plan"
>
> "I want to see a chart showing pipeline by state in the progress
>  dashboard"

**Tips:** For anything bigger than a small change, say `/new-feature`
first — Claude will walk you through a structured process to design
it before building it.

### "Something is broken"
> "When I click on a district in California, the panel shows the wrong
>  enrollment number"
>
> "The summary bar at the top of the map shows $0 for pipeline even
>  though I can see districts with pipeline on the map"

**Tips:** Describe what you expected, what happened instead, and any
specific data that looks wrong. Include the district name or state
if relevant.

### "I want to understand something"
> "How does the choropleth coloring work? What determines which
>  districts are dark vs light?"
>
> "Where does the pipeline number come from for each district?"
>
> "What happens when a user connects their Google Calendar?"

### "I want to change data or metrics"
> "Add FY27 bookings columns to the explore grid"
>
> "The sessions revenue for FY26 should include the new product line —
>  where would I add that?"

## What Makes a Good Prompt

**Be specific about the outcome:**
- Bad: "Fix the plans page"
- Good: "On the plans page, the plan cards are overlapping on mobile"

**Name what you see, not code terms:**
- Bad: "Update the PlanViewPanel component"
- Good: "In the plan detail view (the panel that opens when you click
   a plan), change the header to show the plan name in bold"

**Give context when something is ambiguous:**
- Bad: "Change the table"
- Good: "In the explore data grid (the spreadsheet view that opens
   over the map), add a column for total revenue"

## Key Terms

| What you might call it | What it is in the app |
|----------------------|----------------------|
| The map | The main view with colored districts |
| The sidebar / panel | The panel that slides in from the left |
| The data grid / spreadsheet | The explore overlay with sortable columns |
| The summary bar | The metrics bar at the top of the map |
| District detail | The panel showing info about one district |
| Plan view | The detail view for a territory plan |
| The filter bar | The search/filter controls above the map |
| Progress dashboard | The charts showing activity and outcome metrics |

## Available Commands

| Command | When to use it |
|---------|---------------|
| `/new-feature` | Building something new (walks you through design first) |
| `/design-review` | Check if a built feature matches the design system |
| `/backend-discovery` | Understand the database before making data changes |

Other commands (`/frontend-design`, `/design-explore`) are used internally
by `/new-feature` — you don't need to call them directly.

## Things to Know

- Claude reads your project files to understand the code. It may take
  a moment on the first request.
- For big changes, Claude will ask you clarifying questions before
  starting. This is normal and leads to better results.
- If Claude's change isn't quite right, just tell it what's wrong in
  plain language — "that's too big", "wrong color", "I meant the
  other table".
- You can ask Claude to undo its last change if something went wrong.
