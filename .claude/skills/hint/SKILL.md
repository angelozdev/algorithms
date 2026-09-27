---
name: hint
description: Use when the user asks for a hint or help on a problem or concept exercise, or asks why their code fails — "pista", "dame una pista", "ayuda", "estoy atascado", "¿por qué falla?". Escalates exactly one level per request (Socratic question, then the key idea in words) and never gives code or pseudocode.
---

# hint — one level at a time

The hard rules in `CLAUDE.md` apply. Reply in Spanish.

1. **Target:** the problem or exercise the user names. If they name none and exactly one item has `status: solving` (the reminder context lists them), use that one. Otherwise, ask which one.
2. **Read** its README: the frontmatter `hints` (0, 1 or 2) and the Log.
3. **Next level = `hints + 1`:**
   - **Level 1 — one Socratic question.** It points at the key insight without naming any steps. You may read the user's `solution.*` to aim the question at their current approach (for example, at what their inner loop keeps recomputing). Do not state the answer.
   - **Level 2 — the key idea in plain words**, in 1–3 sentences. No code, no pseudocode, no step-by-step algorithm, no variable names.
   - **Already at level 2:** no more hints. Point to the concept notes linked in the README and to their exercises, and mention that `/give-up` exists (the user has to type it).
4. **Already solved but not optimal** (`complexity.optimal: false`): the same ladder applies to reaching the better complexity, and the counter keeps going.
5. **"Why does it fail?":** use only what the runner printed, meaning the failing input and the user's own output. Never reveal other hidden inputs or any expected value.
6. **Record:** set `hints` to the new level and append `- YYYY-MM-DD · hint <level>` to the Log. Run `pnpm -s sync`.
7. **Reply** with the hint and nothing else.
