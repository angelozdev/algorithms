---
id: maps-and-sets/03
title: Robot trail
concept: maps-and-sets
---
# Robot trail

## Statement

A warehouse robot 🤖 starts at cell `(0, 0)` of an endless grid and follows `moves`, one step per character: `U` goes up, `D` down, `L` left and `R` right. Return how many **different** cells it visits, counting the starting cell.

**Examples**

- `moves = ""` → `1`
- `moves = "UR"` → `3`
- `moves = "URDL"` → `4` (the last step returns to the start)

**Constraints:** `0 <= moves.length <= 10^5` · `moves` has only the characters `U`, `D`, `L` and `R`
