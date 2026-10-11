---
id: big-o/02
title: Halving ticks
concept: big-o
---
# Halving ticks

## Statement

A dashboard redraws its widgets in rounds. The first round redraws `n` widgets, and every round after that redraws half as many (rounded down), until a round would redraw none:

```
ticks = 0
size = n
while size >= 1:
    for k from 1 to size:
        ticks = ticks + 1
    size = size // 2        (integer division: 7 // 2 = 3)
```

Return the final value of `ticks` for the given `n`.

**Examples**

- `n = 8` → `15` (8 + 4 + 2 + 1)
- `n = 6` → `10` (6 + 3 + 1)
- `n = 1` → `1`

**Constraints:** `0 <= n <= 10^15`

**Follow-up:** before you code, guess how the answer grows as `n` grows: like `n`, like `n log n`, or like `n²`? Then check your guess against your results.
