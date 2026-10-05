---
name: hint
description: Use when the user asks for a hint or help on a problem or concept exercise, or asks why their code fails — "pista", "dame una pista", "ayuda", "estoy atascado", "¿por qué falla?". Escalates exactly one level per request (Socratic question, then the key idea in words) and never gives code or pseudocode. Plain language questions ("¿qué hace enumerate?") are not hints.
---

# hint — one level at a time

The hard rules in `CLAUDE.md` apply. Reply in Spanish.

**First, is it a hint request at all?** The user has almost no Python experience, so many questions are about the language, not the problem:

- **Language questions are not hints:** "¿cómo declaro un dict en Python?", "¿qué hace enumerate?", "¿cómo se escribe un for en TS?", "¿cómo ordeno una lista?". Answer directly, briefly, with a small generic example unrelated to the current problem: different names, different data, and not the pattern the problem needs. Record nothing.
- **Approach questions dressed as syntax are hints:** "¿cómo uso un dict para resolver esto?", "¿con qué estructura guardo lo que ya vi?". They ask how to solve the problem, so follow the steps below.
- **When in doubt,** answer only the language part, generically, and ask whether they also want a hint.

1. **Target:** the problem or exercise the user names. If they name none and exactly one item is in progress, use that one. Otherwise, ask which one. The reminder context lists the items in progress (open attempts).
2. **Status:** run `pnpm -s study status <id> --json`.
   - `exam: true`: this is an exam attempt. Say in one sentence that exams take no hints, and stop. Do not run `study record hint`.
   - `initialized: false`: there is no study database yet. Hints still work, but nothing is counted: take the current level from this conversation.
   - Otherwise the current level is `open.hints` (0 when `open` is null).
3. **Next level = current level + 1:**
   - **Level 1 — one Socratic question.** It points at the key insight without naming any steps. You may read the user's solution file (`.study/solutions/…/solution.<lang>`, or `solution.<lang>` in the item's folder until `pnpm study migrate`) to aim the question at their current approach (for example, at what their inner loop keeps recomputing). Do not state the answer.
   - **Level 2 — the key idea in plain words**, in 1–3 sentences. No code, no pseudocode, no step-by-step algorithm, no variable names.
   - **Already at level 2:** no more hints. Point to the concept notes linked in the README and to their exercises, and mention that `/give-up` exists (the user has to type it).
4. **Already solved** (`everGreen: true` and `open: null`): the same ladder applies to reaching a better complexity. There is no open attempt to count it on, so take the level from this conversation; `study record hint` answers "Not recorded".
5. **"Why does it fail?":** run `pnpm -s test <id> --lang all --json --no-record` and use only what it reports: the failing input and the user's own output or error. Never reveal other hidden inputs or any expected value. `--no-record` is mandatory: your runs are not the user's practice.
6. **Record:** if you gave a level 1 or 2 hint, run `pnpm -s study record hint <id>`. At the maximum level, record nothing. Never edit README frontmatter or add Log lines: progress lives in `.study/`.
7. **Reply** with the hint and nothing else.
