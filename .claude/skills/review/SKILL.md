---
name: review
description: Use when the user says their solution passes or asks for a review of a problem or concept exercise — "ya pasa", "está en verde", "revisa mi solución", "review", "¿es óptima?". Confirms green with the runner, analyzes the complexity of the user's code, and records the result. Never explains how to reach a better complexity.
---

# review — confirm green, measure, record

The hard rules in `CLAUDE.md` apply. Reply in Spanish.

1. **Target:** as in the `hint` skill.
2. **Run** `pnpm -s test <id> --lang all --json` and parse the array.
3. **Not green in any language:** tell the user which phase fails in each language (load error, examples, hidden, stress) and stop. Debugging help goes through the `hint` skill.
4. **Green:** read `solution.<lang>` for each green language and work out its time and space complexity (Big-O in terms of the input names). Compare it with the best known complexity for this problem.
5. **Update the frontmatter:**
   - `status: solved` (also when it was `revealed`).
   - `solved_in`: the green languages.
   - Problems only: `complexity: { time: "O(…)", space: "O(…)", optimal: true|false }`.
   - Append a Log line: `- YYYY-MM-DD · green in py, O(n²) → better exists` or `- YYYY-MM-DD · green in py, O(n) ✓ optimal`.
6. **Reply:**
   - Give the complexity of their code.
   - If it is not optimal, say only "Existe una solución O(…) en tiempo" (or in space), and nothing about how to get there. Offer the `hint` skill if they want to go for it.
7. **Show the optimal solution** only if the user then explicitly asks to see it:
   - Show it **in chat**, with a short explanation.
   - Set `solution_revealed: true` and log `- YYYY-MM-DD · optimal solution shown`.
   - Never write it to a file.
8. **Sync:** `pnpm -s sync && pnpm -s check`.
