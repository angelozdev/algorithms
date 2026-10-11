---
id: big-o/03
title: Fits the budget
concept: big-o
---
# Fits the budget

## Statement

An online judge gives your code a budget of `100,000,000` (10⁸) steps. An algorithm whose work grows like `growth` takes this many steps on an input of size `n`:

| `growth` | Steps |
|---|---|
| `"1"` | 1 |
| `"log n"` | log₂ n |
| `"n"` | n |
| `"n log n"` | n · log₂ n |
| `"n^2"` | n² |
| `"n^3"` | n³ |
| `"2^n"` | 2ⁿ |
| `"n!"` | n! = 1 · 2 · … · n |

Return `true` if the number of steps is at most `100,000,000`, and `false` otherwise.

**Examples**

- `growth = "n^2", n = 10000` → `true` (exactly 10⁸ steps still fits)
- `growth = "n^2", n = 10001` → `false`
- `growth = "n!", n = 12` → `false` (12! = 479,001,600)

**Constraints:** `1 <= n <= 10^9` · `growth` is one of the eight strings in the table
