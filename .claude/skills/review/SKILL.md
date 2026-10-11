---
name: review
description: Use when the user says their solution passes or asks for a review of a problem or concept exercise — "ya pasa", "está en verde", "revisa mi solución", "review", "¿es óptima?". Confirms green with the runner, analyzes the complexity of the user's code, and records the result. Never explains how to reach a better complexity.
---

# review — confirm green, measure, record

The hard rules in `CLAUDE.md` apply. Reply in Spanish.

1. **Target:** as in the `hint` skill.
2. **Run** `pnpm -s test <id> --lang all --json --no-record` and parse the array. `--no-record` is mandatory: your run must not count as the user's.
3. **Not green in any language:** tell the user which phase fails in each language (load error, examples, hidden, stress) and stop. Debugging help goes through the `hint` skill.
4. **Green:** run `pnpm -s study status <id> --json`. If `initialized` is true and `everGreen` is false, the user's own run has not recorded the green yet (yours never does): ask them to run it themselves (▶ Run in the playground, `pnpm test <id>`, or a save under `pnpm watch`), then go on.
5. **Analyze:** read the user's solution for each green language (`.study/solutions/…/solution.<lang>`, or `solution.<lang>` in the item's folder until `pnpm study migrate`) and work out its time and space complexity (Big-O in terms of the input names). Compare it with the best known complexity for this problem.
6. **Record (problems only):** `pnpm -s study record complexity <id> --time "O(…)" --space "O(…)" --optimal` (or `--not-optimal`). Skip it when `initialized` is false. Never edit README frontmatter or add Log lines.
7. **Reply:**
   - Give the complexity of their code.
   - If it is not optimal, say only "Existe una solución O(…) en tiempo" (or in space), and nothing about how to get there. Offer the `hint` skill if they want to go for it.
8. **Show the optimal solution** only if the user then explicitly asks to see it:
   - Show it **in chat**, with a short explanation.
   - Never write it to a file.
