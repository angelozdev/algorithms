---
slug: recursion
title: Recursion
requires: [big-o]
related: [sorting]
---
# Recursion

## Intuition

Picture a React component tree ⚛️. `<Dashboard>` does not know how to draw every chart: it renders `<Panel>`s and **trusts** each panel to render itself, and each panel trusts its `<Chart>`s. Nobody draws the whole page alone. Recursion is that trick for functions: a function solves a problem by calling **itself** on a smaller piece of it, and trusts that call to return the right answer.

Every recursive function has two parts:
- **The base case** 🛑: a piece so small you answer it directly (an empty list, n = 0, a single note). Without it the calls never stop.
- **The recursive case** 🔁: shrink the problem, call yourself on the smaller piece, then use that answer.

The mental leap is the **leap of faith** 🪂: when you write the recursive case, do not trace every call in your head. Assume the call on the smaller piece already works, and ask only "given that answer, how do I finish mine?". It feels like a looper pedal 🎛️: each layer plays on top of the layer below, and the stack of layers is the whole song.

Under the hood each call waits for the inner one on the **call stack**, like browser tabs opened one inside another: the last one opened is the first one closed.

## Diagram

`total(nums, i)` adds `nums[i:]`. The calls go down to the base case, then the answers come back up:

```
total([4, 1, 3], 0)
│  = 4 + total([4, 1, 3], 1)
│        │  = 1 + total([4, 1, 3], 2)
│        │        │  = 3 + total([4, 1, 3], 3)
│        │        │        │  = 0              ← base case: i is past the end
│        │        │  = 3 + 0 = 3               ← the stack unwinds…
│        │  = 1 + 3 = 4
│  = 4 + 4 = 8                                  ← …back to the first call

call stack at the deepest point (top = newest):
  total(…, 3)   ← returns first
  total(…, 2)
  total(…, 1)
  total(…, 0)   ← returns last
```

## Signals

- The problem is defined in terms of a **smaller version of itself** ("the answer for n uses the answer for n - 1")
- Nested, self-similar data: folders inside folders, comments with replies, components with children
- "Do it for the first part, then the same for the rest"
- Split in halves, solve each half, combine (you will meet it again in sorting)
- You need **every** combination or arrangement (later: backtracking)

## When it fails

- **No base case, or one you never reach** 🔁💥: `RecursionError: maximum recursion depth exceeded` in Python, `RangeError: Maximum call stack size exceeded` in TypeScript.
- **Too deep for the stack:** Python allows about 1,000 nested calls by default, Node about 10,000. One call per element of a 100,000-element list crashes; a loop does not. Use recursion when the depth stays small (a few hundred), or when it is about log n.
- **Exponential blow-up:** a function that calls itself twice on n - 1 makes about 2ⁿ calls. At n = 40 that is a trillion calls, even if each one is tiny. Count the calls (see the table) before you trust a branching recursion.
- **Hidden copies:** `total(nums[1:])` copies the rest of the list at every call, so a "linear" recursion becomes O(n²). Pass an index instead, as in the template.

## Typical complexity

| Shape | Calls | Time | Extra space (the stack) |
|---|---|---|---|
| One call on n - 1, O(1) work each | n | O(n) | O(n) |
| One call on n / 2, O(1) work each | log₂ n | O(log n) | O(log n) |
| Two calls on n - 1 | about 2ⁿ | O(2ⁿ) | O(n) |

Rule: time = number of calls × work per call; stack space = the deepest chain of calls.

## Template

The shape of every recursive function:

```python
def solve(problem):
    if is_small(problem):            # base case: answer directly
        return direct_answer(problem)
    smaller = shrink(problem)        # move toward the base case
    partial = solve(smaller)         # leap of faith: assume it works
    return combine(problem, partial) # finish your own part
```

The sum of a list, with an index instead of a copy — Python:

```python
def total(nums: list[int], i: int = 0) -> int:
    if i == len(nums):               # base case: nothing left
        return 0
    return nums[i] + total(nums, i + 1)
```

TypeScript:

```ts
function total(nums: number[], i = 0): number {
  if (i === nums.length) return 0; // base case: nothing left
  return nums[i] + total(nums, i + 1);
}
```

## Exercises

<!-- auto:exercises -->
- [01 · Collatz steps](exercises/01-collatz-steps/README.md)
- [02 · Echo](exercises/02-echo/README.md)
- [03 · Tower of Hanoi](exercises/03-hanoi/README.md)
<!-- /auto -->

## Quick checks

1. What happens if a recursive function has no base case? What error do you see in Python, and in TypeScript?
2. In the diagram, which runs first: the `4 +` of the first call, or the `0` of the base case? Why?
3. Why can a recursive sum over a 100,000-element list crash Python when a `for` loop does not?
4. A function calls itself twice, each time with n - 1. About how many calls does it make for n = 20?

## My explanation

<!-- Write this yourself, in your own words. Claude never fills this section. -->

## Problems

<!-- auto:problems -->
- [lc-0017 · Letter Combinations of a Phone Number](../../problems/lc-0017-letter-combinations-of-a-phone-number/README.md)
- [lc-0039 · Combination Sum](../../problems/lc-0039-combination-sum/README.md)
- [lc-0046 · Permutations](../../problems/lc-0046-permutations/README.md)
- [lc-0070 · Climbing Stairs](../../problems/lc-0070-climbing-stairs/README.md)
- [lc-0078 · Subsets](../../problems/lc-0078-subsets/README.md)
- [lc-0104 · Maximum Depth of Binary Tree](../../problems/lc-0104-maximum-depth-of-binary-tree/README.md)
- [lc-0110 · Balanced Binary Tree](../../problems/lc-0110-balanced-binary-tree/README.md)
- [lc-0226 · Invert Binary Tree](../../problems/lc-0226-invert-binary-tree/README.md)
- [lc-0543 · Diameter of Binary Tree](../../problems/lc-0543-diameter-of-binary-tree/README.md)
<!-- /auto -->
