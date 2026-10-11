---
id: big-o/01
title: Pair ticks
concept: big-o
---
# Pair ticks

## Statement

This code makes a metronome tick once for every pair of musicians `(i, j)` with `i < j` in a band of `n`:

```
ticks = 0
for i from 0 to n - 1:
    for j from i + 1 to n - 1:
        ticks = ticks + 1
```

Return the final value of `ticks` for the given `n`. Running the loops literally works for small bands, but `n` goes up to a million here.

**Examples**

- `n = 4` → `6`
- `n = 1` → `0` (nobody to pair with)
- `n = 5` → `10`

**Constraints:** `0 <= n <= 10^6`

**Follow-up:** can you answer without any loop at all?
