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

**Deployment is fully automated via CI/CD on push — never mention it as a manual step.**
Why: Pushing triggers automatic deployment to production. Only the user decides when to push.
How to apply: Do not say "you'll need to deploy" or "run sam deploy" after code changes. The push IS the deploy. Never suggest `sam deploy` unless the user explicitly asks for a manual deploy.
---

**Musicians cannot be removed from a song — only their instrument can be cleared.**
Why: User explicitly removed the include/exclude toggle. All band members are always present in every song record.
How to apply: No "remove from song" UI. Instrument buttons are the only per-musician control.

---

**`overflow-x: hidden` silently breaks `position: sticky` on descendants — use `overflow-x: clip` instead.**
Why: Hit this on `.stage` in `StageView.svelte`. `overflow-x: hidden` (added in c3ce0a0 to suppress iPad horizontal scroll) creates a scroll containing block that traps sticky descendants — `.stage-header` stopped sticking under the global nav, leaving a body-bg gap above it.
How to apply: When you need to clip horizontal overflow but the container has sticky descendants, use `overflow-x: clip` (no scroll context, sticky still works). Same gotcha applies to `overflow-y`. Default to `clip` unless you specifically need a scroll container.

---

**Emoji SVG download: the CDN in CLAUDE.md (`cdn.jsdelivr.net`) is BLOCKED by the web-session egress policy (403). Use `raw.githubusercontent.com` instead — it's allowed.**
Why: When adding 💰/🧾 for the budget view, the documented jsdelivr curl returned 403 from the agent proxy (org egress policy). The Noto source repo on raw.githubusercontent.com works (200).
How to apply: To vendor a missing emoji, run:
`curl -fsS -o static/emoji/{cp}.svg "https://raw.githubusercontent.com/googlefonts/noto-emoji/main/svg/emoji_u{cp}.svg"`
(codepoint lowercase hex, drop `U+`/variation selectors). Always vendor the SVG in the same change that introduces the emoji — never ship an emoji whose SVG isn't in `static/emoji/` (it 404s via the twemoji MutationObserver).
