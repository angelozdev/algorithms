---
slug: two-pointers
title: Two pointers
status: learning
requires: []
related: [hash-map, sliding-window]
---
# Two pointers

## Intuition

Picture a pianist playing from both ends of the keyboard at once 🎹: the left hand starts on the lowest key, the right hand on the highest, and they walk toward each other until they meet in the middle. Two pointers is exactly that: instead of one index doing all the work, **two indexes** move through the data, and after each look you decide which one steps forward.

The magic rule: **pointers never walk back** ⏩. Every step moves at least one of them, so after about n steps they are done — no nested loop, no O(n²). The price is that every move needs a reason: "the element I am leaving behind can never be part of the answer". That reason almost always comes from **order** — a sorted array, or sequences that are each already sorted.

Two shapes cover most cases:

- **Converging** ↔️ — one pointer at each end, moving toward each other (a palindrome check, reversing in place).
- **Parallel** ➡️➡️ — one pointer per sequence, both moving forward (merging two sensor streams sorted by timestamp into one dashboard timeline 📈).

## Diagram

Converging — is `"radar"` a palindrome?

```
  r   a   d   a   r
  L               R      r == r ✓  → move both inward
      L       R          a == a ✓  → move both inward
          LR             L meets R → done: palindrome 🎉

5 letters, 2 comparisons, zero steps backwards.
```

Parallel — merge two sensor streams, each sorted by time (ms):

```
a = [10, 40, 50]      b = [20, 30, 60]

step   a[i]   b[j]   take   move
 1      10     20     10     i →
 2      40     20     20     j →
 3      40     30     30     j →
 4      40     60     40     i →
 5      50     60     50     i →
        a is empty → append the rest of b: 60

out = [10, 20, 30, 40, 50, 60]      ← each step moved exactly ONE cursor
```

## Signals

- The input is **sorted**, or sorting it first does not change the answer
- "Find two elements such that…", and a follow-up asks for O(1) extra memory
- "Reads the same forwards and backwards", symmetry, "reverse in place"
- Two sorted sequences to merge, compare, or walk "in the same order"
- A nested loop `for i … for j > i …` where most pairs are obviously useless

## When it fails

- **No order, no reason to move** 🙅 — in an unsorted array like `[3, 9, 1, 7]`, the two ends tell you nothing about the values in the middle, so you cannot justify moving either pointer. Fix: sort first (O(n log n), but you lose the original indexes) or use a hash map.
- **The answer needs to look back** — if an element a pointer already passed can still matter later, the pointers would have to rewind, and you are back to O(n²).

## Typical complexity

| Shape | Time | Extra space |
|---|---|---|
| Converging on n items | O(n) | O(1) |
| Parallel on n + m items | O(n + m) | O(1), plus the output if you build one |
| Sort first, then converge | O(n log n) | depends on the sort |

## Template

Converging: reverse a list in place — Python:

```python
def reverse_in_place(items: list[int]) -> None:
    left, right = 0, len(items) - 1
    while left < right:  # stop when they meet or cross
        items[left], items[right] = items[right], items[left]
        left += 1
        right -= 1
```

Converging: reverse a list in place — TypeScript:

```ts
function reverseInPlace(items: number[]): void {
  let left = 0;
  let right = items.length - 1;
  while (left < right) {
    [items[left], items[right]] = [items[right], items[left]];
    left++;
    right--;
  }
}
```

Parallel: merge two sorted lists — Python:

```python
def merge(a: list[int], b: list[int]) -> list[int]:
    i, j = 0, 0
    out: list[int] = []
    while i < len(a) and j < len(b):
        if a[i] <= b[j]:
            out.append(a[i])
            i += 1
        else:
            out.append(b[j])
            j += 1
    out.extend(a[i:])  # at most one of these two
    out.extend(b[j:])  # still has elements left
    return out
```

Parallel: merge two sorted lists — TypeScript:

```ts
function merge(a: number[], b: number[]): number[] {
  let i = 0;
  let j = 0;
  const out: number[] = [];
  while (i < a.length && j < b.length) {
    if (a[i] <= b[j]) {
      out.push(a[i]);
      i++;
    } else {
      out.push(b[j]);
      j++;
    }
  }
  return out.concat(a.slice(i), b.slice(j)); // at most one still has elements left
}
```

## Exercises

<!-- auto:exercises -->
- ✓ [01 · Pair sum](exercises/01-pair-sum/README.md)
- ○ [02 · Hidden melody](exercises/02-hidden-melody/README.md)
- ○ [03 · Sorted squares](exercises/03-sorted-squares/README.md)
<!-- /auto -->

## Quick checks

1. With converging pointers on an array of 1,000 items, what is the maximum number of loop iterations, and why can it never be more?
2. Why is order (a sorted input) usually what makes moving a pointer "safe"?
3. In the merge diagram, why does each step move only one cursor and not both?
4. Name one problem where two pointers is the wrong tool, and say why.

## My explanation

<!-- Write this yourself, in your own words. Claude never fills this section. -->

## Problems

<!-- auto:problems -->
- ○ [lc-0011 · Container With Most Water](../../problems/lc-0011-container-with-most-water/README.md)
- ○ [lc-0015 · 3Sum](../../problems/lc-0015-3sum/README.md)
- ✓ [lc-0021 · Merge Two Sorted Lists](../../problems/lc-0021-merge-two-sorted-lists/README.md)
- … [lc-0026 · Remove Duplicates from Sorted Array](../../problems/lc-0026-remove-duplicates-from-sorted-array/README.md)
- ✓ [lc-0027 · Remove Element](../../problems/lc-0027-remove-element/README.md)
- ○ [lc-0042 · Trapping Rain Water](../../problems/lc-0042-trapping-rain-water/README.md)
- ○ [lc-0075 · Sort Colors](../../problems/lc-0075-sort-colors/README.md)
- ○ [lc-0125 · Valid Palindrome](../../problems/lc-0125-valid-palindrome/README.md)
- … [lc-2181 · Merge Nodes in Between Zeros](../../problems/lc-2181-merge-nodes-in-between-zeros/README.md)
<!-- /auto -->
