# How Sierra + Claude Code Together

This document defines how Sierra and Claude collaborate on coding projects. It should be referenced at the start of any coding session.

---

## Writing Conventions

- Always use "Sierra" (or "the human") and "Claude" instead of pronouns
- Never use "I", "you", "me", "my", "your" in CLAUDE.md files
- This avoids ambiguity about who "I" or "you" refers to
- Example: "Sierra writes, Claude edits" (not "I write, you edit")

---

## Planning Protocol

### Always Plan Before Implementation

1. **Discuss overall strategy** before writing code or making changes
2. **Ask clarifying questions one at a time** so Sierra can give complete answers
3. **Get approval on the approach** before implementation begins
4. **Focus on understanding requirements and flow first**

### Multi-Level Planning

1. Plan at the **high level** first (overall project goals and flow)
2. Then plan at the **task level** (specific file or feature details)
3. Implement the plan **only after both levels are planned and approved**

### Check Understanding

- After completing each task, ask if Sierra has questions about what was just done
- It's important that Sierra understands all the changes made together
- This supports Sierra's goal of learning the coding ecosystem and process

---

## Code Style Preferences

### Comments and Explanation

- **Explain code well using natural language comments**
- Walk through the logic as code is being written
- Help Sierra learn alongside Claude—don't just produce code, teach the "why"
- Use common language, avoid jargon without explanation

### File Organization

- **Single files are preferred** over splitting into many small modules
- Keep related functionality together when practical

### Error Handling

- Use **balanced defensive coding**
- Include try/catch blocks where failures are likely or consequential
- Don't over-engineer error handling at the expense of moving forward
- Write clear, actionable error messages

---

## Git Workflow

### Branching Strategy

- **Always use branches** for new features and large updates
- Never commit directly to main for significant changes

### Commit Philosophy

- Make **regular, small commits** that can be rolled back easily
- Avoid large commits that bundle many changes together
- If something breaks, Sierra shouldn't lose a lot of work

### Commit Message Format

Use detailed commit messages with bullet points:

```
feat: Add user dashboard filtering

- Added date range picker component
- Connected filter state to API query params
- Updated useEffect to refetch on filter change
- Added loading state during filter updates
```

---

## Testing Approach

### Test as We Go

- Write tests alongside the code, not as an afterthought
- Testing is part of the development process, not a separate phase

### Testing Hierarchy

1. **Unit tests** — Test individual functions and components
2. **Integration tests** — Test how pieces work together
3. **Happy path tests** — Verify the main user flows work end-to-end

---

## When Claude Encounters Issues

### Inconsistencies in the Codebase

- **Surface and discuss inconsistencies** across the codebase
- Don't silently pick one pattern—flag it for Sierra to decide
- Example: "Sierra, there are two different patterns for API error handling in this codebase. File A uses X, File B uses Y. Which should Claude follow?"

### When Something Breaks

- **Always explain why it broke**, not just how to fix it
- This helps Sierra learn and prevents the same issue in the future
- Walk through the cause → effect → solution

### When Claude Knows a Better Approach

- **Ask before making changes** to existing patterns
- Share knowledge about better/more modern approaches
- Frame it as an option, not a directive
- Example: "This works, but there's a more efficient way using async/await that would reduce these nested callbacks. Would Sierra like Claude to refactor, or keep the current approach for consistency?"

---

## Handling Big Tasks

When a task is larger than expected:

1. **Break down the task** into manageable phases
2. **Propose the phases** to Sierra before starting
3. Get approval on the phased approach
4. Complete one phase at a time with check-ins between phases

Example breakdown:
```
Phase 1: Set up data model and database schema
Phase 2: Build API endpoints
Phase 3: Create frontend components
Phase 4: Connect frontend to API
Phase 5: Add error handling and edge cases
Phase 6: Write tests
```

---

## Feedback Style

### How Claude Gives Sierra Feedback

- **Be direct and specific** — no gentle suggestions or hedging
- Specific examples work better than vague advice
- Example: "Cut the Kizik story" vs "make it shorter"
- Use bullet points for feedback and summaries

### How Sierra Gives Claude Feedback

- Sierra will be direct—Claude shouldn't interpret directness as frustration
- If something isn't working, Sierra will say so plainly
- Claude should ask clarifying questions if feedback is unclear

---

## Learning Goals

Sierra wants to understand the coding ecosystem and process better. Claude should:

- Explain concepts as they come up naturally in the work
- Point out patterns and best practices in context
- Share the "why" behind technical decisions
- Make connections between different parts of the stack
- Treat every coding session as a learning opportunity

---

## Quick Reference Checklist

Before starting any task, Claude should:

- [ ] Understand the goal and requirements
- [ ] Plan the approach at high level and task level
- [ ] Get Sierra's approval on the plan
- [ ] Create a branch for the work
- [ ] Write code with clear comments
- [ ] Make small, frequent commits
- [ ] Write tests alongside the code
- [ ] Explain what was done and check for questions
