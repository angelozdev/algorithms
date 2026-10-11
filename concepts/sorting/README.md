---
slug: sorting
title: Sorting
requires: [big-o, recursion, maps-and-sets]
related: [two-pointers]
---
# Sorting

## Intuition

You sort a hand of cards without thinking 🃏: take the next card and slide it left until it sits after a smaller one. That is **insertion sort**: simple, and fine for a hand of cards, but O(n²) for a long list, because each new item may slide past everything before it.

For big inputs, divide and conquer: split the pile in two, sort each half (recursion!), then **merge** the two sorted halves by repeatedly taking the smaller front card. That is **merge sort**, O(n log n): about log₂ n levels of splitting, and O(n) merging work per level.

In practice you rarely write either one: Python's `sorted` / `list.sort` and TypeScript's `Array.prototype.sort` are fast O(n log n) sorts. Your job is to tell them **what order you want**: by which key, ascending or descending, and how to break ties. It is the table header you click in a dashboard 📊: sort by status, then by name. Both built-ins are **stable**: items that tie keep their previous relative order, which is what lets the "then by" part work.

## Diagram

Insertion sort on `[5, 2, 4, 1]` (the bar separates the sorted part):

```
[5 | 2, 4, 1]    take 2: it slides left past 5            → [2, 5 | 4, 1]
[2, 5 | 4, 1]    take 4: it slides left past 5            → [2, 4, 5 | 1]
[2, 4, 5 | 1]    take 1: it slides left past 5, 4 and 2   → [1, 2, 4, 5]
```

Merge sort on the same list:

```
            [5, 2, 4, 1]
            /          \
        [5, 2]        [4, 1]          split: about log₂ n levels
        /    \        /    \
      [5]   [2]     [4]   [1]
        \    /        \    /
        [2, 5]        [1, 4]          merge: take the smaller front each time
            \          /
           [1, 2, 4, 5]
```

Stability, by example:

```
rows, already sorted by name:     (ana, 3)  (bo, 1)  (cy, 3)  (di, 1)
stable sort by the number:        (bo, 1)  (di, 1)  (ana, 3)  (cy, 3)
                                  ties keep their name order ↑
```

## Signals

- The output must come **in order**: "sorted by …", "in increasing …", "alphabetically"
- Ties are broken by a second rule: "… and, for equal …, by …"
- "Rank", "position", "top", "the k smallest or largest"
- Equal or close values need to end up **next to each other**
- A nested loop compares every pair just to find which comes first

## When it fails

- **TypeScript's default sort compares text:** `[10, 9, 1].sort()` gives `[1, 10, 9]`. Always pass a comparator for numbers: `nums.sort((a, b) => a - b)`.
- **A comparator returns a number, not a boolean:** negative means "a first", positive means "b first", 0 means a tie. `(a, b) => a > b` is a bug.
- **In place or a copy?** Python's `list.sort()` sorts in place and returns `None` (`x = x.sort()` loses your list); `sorted(x)` returns a new list. TypeScript's `arr.sort()` sorts in place *and* returns the same array; `arr.toSorted()` returns a copy.
- **Sorting loses positions:** once sorted, you no longer know where each item came from. Sort the indexes (or `(value, index)` pairs) when you need them.
- **O(n log n) is not always the best:** finding only the smallest item is one O(n) pass, and values from a tiny range (ages 0 to 120) can be counted instead of compared.

## Typical complexity

| Sort | Time | Extra space | Stable |
|---|---|---|---|
| Insertion sort | O(n²); O(n) on almost sorted input | O(1) | yes |
| Merge sort | O(n log n) | O(n) | yes |
| Built-in (`sorted`, `list.sort`, `Array.prototype.sort`) | O(n log n) | O(n) | yes |

Sorting strings also pays for comparing them: two long strings that share a long prefix take longer to compare.

## Template

Python:

```python
words = ["kiwi", "fig", "banana", "apple"]

sorted(words)                                  # ['apple', 'banana', 'fig', 'kiwi']
sorted(words, key=len)                         # by length; ties keep their order (stable)
sorted(words, key=lambda w: (len(w), w))       # by length, then alphabetically
sorted(words, reverse=True)                    # descending

values = [30, 10, 20]
order = sorted(range(len(values)), key=lambda i: values[i])   # [1, 2, 0]: the indexes, by value
```

TypeScript:

```ts
const words = ["kiwi", "fig", "banana", "apple"];

[...words].sort(); // alphabetical (copy first: sort works in place)
[...words].sort((a, b) => a.length - b.length); // by length; ties keep their order (stable)
[...words].sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)); // by length, then alphabetically
[...words].sort().reverse(); // descending

const values = [30, 10, 20];
const order = values.map((_, i) => i).sort((i, j) => values[i] - values[j]); // [1, 2, 0]: the indexes, by value
```

## Exercises

<!-- auto:exercises -->
- [01 · Insertion shifts](exercises/01-insertion-shifts/README.md)
- [02 · Leaderboard](exercises/02-leaderboard/README.md)
- [03 · Chart positions](exercises/03-chart-positions/README.md)
<!-- /auto -->

## Quick checks

1. Why does `[10, 9, 1].sort()` give `[1, 10, 9]` in TypeScript, and how do you fix it?
2. What does "stable" mean? Give one case where it changes the result.
3. How many slides does insertion sort make on a list that is already sorted? And on a list of n items in reverse order?
4. Why does merge sort have about log₂ n levels, and why does each level cost O(n)?

## My explanation

<!-- Write this yourself, in your own words. Claude never fills this section. -->

## Problems

<!-- auto:problems -->
- [lc-0056 · Merge Intervals](../../problems/lc-0056-merge-intervals/README.md)
- [lc-0721 · Accounts Merge](../../problems/lc-0721-accounts-merge/README.md)
- [lc-1235 · Maximum Profit in Job Scheduling](../../problems/lc-1235-maximum-profit-in-job-scheduling/README.md)
<!-- /auto -->
