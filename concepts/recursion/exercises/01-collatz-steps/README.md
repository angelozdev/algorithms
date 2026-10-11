---
id: recursion/01
title: Collatz steps
concept: recursion
---
# Collatz steps

## Statement

The hailstone game starts from a positive integer `n` and repeats one rule: if the number is even, halve it; if it is odd, triple it and add one. The game ends at `1`. Written as a recursive definition:

```
steps(1) = 0
steps(n) = 1 + steps(n / 2)        if n is even
steps(n) = 1 + steps(3 * n + 1)    if n is odd
```

Return `steps(n)`: how many rule applications it takes to reach `1`.

**Examples**

- `n = 1` → `0`
- `n = 6` → `8` (6 → 3 → 10 → 5 → 16 → 8 → 4 → 2 → 1)
- `n = 7` → `16`

**Constraints:** `1 <= n <= 10^6` (along the way the numbers can grow far beyond 10^6, and every game reaches 1 in fewer than 600 steps)
