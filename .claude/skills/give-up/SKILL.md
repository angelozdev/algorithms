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
   - Anything else means stop. Record nothing.
3. **Explain in chat:**
   - the key insight;
   - the approach, step by step;
   - the optimal solution, in the language the user has been using;
   - its time and space complexity;
   - links to the relevant concept notes.

   Never write the solution to any file.
4. **Record:** run `pnpm -s study record give-up <id>`. It closes the open attempt as given up, so `study status` reports `revealed: true` from now on. "Not recorded" means the item had no open attempt (already solved or revealed), or there is no study database yet; both are fine. Never edit README frontmatter.
5. **Suggest** retrying from scratch in a few days without looking at the solution.
