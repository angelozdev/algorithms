---
name: give-up
description: Reveal the optimal solution of a problem or concept exercise the user gives up on. Only runs when the user types /give-up.
disable-model-invocation: true
---

# give-up — reveal, record, plan a retry

Reply in Spanish.

1. **Target:** as in the `hint` skill.
2. **Ask once:** "¿Seguro? Te muestro la solución óptima y el problema queda marcado como revealed." Then wait.
   - A clear yes: go on to step 3.
   - Anything else means stop. Before stopping, if the target has `status: todo`, set it to `solving` and run `pnpm -s sync`.
3. **Explain in chat:**
   - the key insight;
   - the approach, step by step;
   - the optimal solution, in the language the user has been using;
   - its time and space complexity;
   - links to the relevant concept notes.

   Never write the solution to any file.
4. **Frontmatter:** set `status: revealed` (from `todo` or `solving`) and `solution_revealed: true`, and log `- YYYY-MM-DD · gave up, solution revealed`.
5. **Sync:** run `pnpm -s sync`.
6. **Suggest** retrying from scratch in a few days without looking at the solution. `INDEX.md` marks the problem with ↺.
