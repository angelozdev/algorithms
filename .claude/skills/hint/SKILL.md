---
name: hint
description: Use when the user asks for a hint or help on a problem or concept exercise, or asks why their code fails — "pista", "dame una pista", "ayuda", "estoy atascado", "¿por qué falla?". Escalates exactly one level per request (Socratic question, then the key idea in words) and never gives code or pseudocode. Plain language questions ("¿qué hace enumerate?") are not hints.
---

# hint — one level at a time

The hard rules in `CLAUDE.md` apply. Reply in Spanish.

**First, is it a hint request at all?** The user has almost no Python experience, so many questions are about the language, not the problem:

- **Language questions are not hints:** "¿cómo declaro un dict en Python?", "¿qué hace enumerate?", "¿cómo se escribe un for en TS?", "¿cómo ordeno una lista?". Answer directly, briefly, with a small generic example unrelated to the current problem: different names, different data, and not the pattern the problem needs. Do not change `hints` or the Log.
- **Approach questions dressed as syntax are hints:** "¿cómo uso un dict para resolver esto?", "¿con qué estructura guardo lo que ya vi?". They ask how to solve the problem, so follow the steps below.
- **When in doubt,** answer only the language part, generically, and ask whether they also want a hint.

1. **Target:** the problem or exercise the user names. If they name none and exactly one item is in progress, use that one. Otherwise, ask which one. In progress means `status: solving`, or `status: todo` with a `solution.py` or `solution.ts` in its folder (for example, one that `pnpm watch` created). The reminder context lists these items.
2. **Read** its README: the frontmatter `hints` (0, 1 or 2) and the Log.
3. **Next level = `hints + 1`:**
   - **Level 1 — one Socratic question.** It points at the key insight without naming any steps. You may read the user's `solution.*` to aim the question at their current approach (for example, at what their inner loop keeps recomputing). Do not state the answer.
   - **Level 2 — the key idea in plain words**, in 1–3 sentences. No code, no pseudocode, no step-by-step algorithm, no variable names.
   - **Already at level 2:** no more hints. Point to the concept notes linked in the README and to their exercises, and mention that `/give-up` exists (the user has to type it).
4. **Already solved but not optimal** (`complexity.optimal: false`): the same ladder applies to reaching the better complexity, and the counter keeps going.
5. **"Why does it fail?":** run `pnpm -s test <id> --lang all --json` and use only what it reports: the failing input and the user's own output or error. Never reveal other hidden inputs or any expected value.
6. **Record:** if the target has `status: todo`, set it to `solving`. If you gave a hint (level 1 or 2), set `hints` to that level and append `- YYYY-MM-DD · hint <level>` to the Log. If the user was already at level 2, leave `hints: 2` and append `- YYYY-MM-DD · hint refused (max level)`. Run `pnpm -s sync`.
7. **Reply** with the hint and nothing else.
