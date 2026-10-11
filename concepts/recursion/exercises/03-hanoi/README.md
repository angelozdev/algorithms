---
id: recursion/03
title: Tower of Hanoi
concept: recursion
---
# Tower of Hanoi

## Statement

Three pegs are named `"A"`, `"B"` and `"C"`. Peg `A` holds `n` disks of different sizes, the largest at the bottom and the smallest on top. Move the whole tower to peg `C`, following two rules:

- move one disk at a time: the top disk of one peg goes onto the top of another;
- never put a disk on top of a smaller one.

Return the moves, in order, as strings `"<from>-><to>"` (for example `"A->C"`), using the fewest moves possible. The fewest-moves sequence is unique.

**Examples**

- `n = 1` → `["A->C"]`
- `n = 2` → `["A->B","A->C","B->C"]`
- `n = 3` → `["A->C","A->B","C->B","A->C","B->A","B->C","A->C"]`

**Constraints:** `1 <= n <= 12`
