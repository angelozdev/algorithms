---
id: recursion/02
title: Echo
concept: recursion
---
# Echo

## Statement

An echo of `n` fades down to `1` and comes back up 🔊: the numbers `n, n - 1, …, 2, 1, 2, …, n - 1, n`, separated by single spaces. Return the echo of `n` as a string.

**Examples**

- `n = 1` → `"1"`
- `n = 3` → `"3 2 1 2 3"`
- `n = 5` → `"5 4 3 2 1 2 3 4 5"`

**Constraints:** `1 <= n <= 500`

**Follow-up:** write it with recursion, then notice what your function does *before* its recursive call and what it does *after* it returns.
