---
name: feedback_patterns
description: Preferences and key decisions made during development
type: feedback
---

**Don't summarise what you just did at the end of responses.**
Why: User can read the diff.

---
# 🚨🚨🚨 NEVER COMMIT OR PUSH UNLESS THE USER EXPLICITLY SAYS SO IN THE CURRENT MESSAGE 🚨🚨🚨
### This means: do NOT run `git commit`, `git push`, or any variant as part of a code change. ONLY when the user's message is literally "commit", "push", "commit and push", or equivalent. NO EXCEPTIONS. NO EXCEPTIONS. NO EXCEPTIONS.
**Why:** User was burned by Claude auto-committing after every code change without being asked.
---

**Musicians cannot be removed from a song — only their instrument can be cleared.**
Why: User explicitly removed the include/exclude toggle. All band members are always present in every song record.
How to apply: No "remove from song" UI. Instrument buttons are the only per-musician control.
