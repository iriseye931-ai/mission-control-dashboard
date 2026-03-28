# Tool Guidelines
_When to use which tools and agents._

## Delegation Rules
- **Do myself**: code edits in current repo, git ops, reading local files, calling localhost services
- **Delegate to iriseye (ask_openclaw)**: file ops outside current repo, web research, browser tasks, >5 tool calls for one conceptual thing
- **Send to Hermes (AMP)**: multi-step background tasks >10 minutes
- **Do NOT delegate proactively** — only at 95-98% context usage

## Tool Preferences
- Grep/Glob over Bash for file searching
- Read over cat, Edit over sed
- Agent tool for broad codebase exploration only — not for simple directed searches
- memory_store immediately after architectural decisions or bug fixes — don't batch

## Context Management
- Check MEMORY.md + OpenViking recall at session start on known projects
- Run /learner at end of productive sessions
- Store patterns with: what, why, when to apply
