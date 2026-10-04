---
id: lc-0295
title: Find Median from Data Stream
source: leetcode
url: https://leetcode.com/problems/find-median-from-data-stream/
difficulty: hard
patterns: [heap]
concepts: [heap, class-design]
lists: [grind-75]
status: todo
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 295. Find Median from Data Stream

## Statement

Design a `MedianFinder` class that tracks a running median as integers arrive one at a time from a stream. `addNum(num)` adds a new value to the structure. `findMedian()` returns the median of every value added so far: the middle value when the count is odd, or the average of the two middle values when it is even. An answer within `1e-5` of the true median is accepted.

**Examples**

- `["MedianFinder", "addNum", "addNum", "findMedian", "addNum", "findMedian"]`, `[[], [1], [2], [], [3], []]` → `[null, null, null, 1.5, null, 2.0]`

**Constraints:** `-10^5 <= num <= 10^5` · there will be at least one element in the data structure before calling `findMedian` · at most `5 * 10^4` calls will be made to `addNum` and `findMedian`

**Follow-up:** How would your approach change if every stream value were guaranteed to fall inside `[0, 100]`? What if only 99% of the values were guaranteed to fall in that range?

## Concepts

<!-- auto:concepts -->
- heap (missing)
- class-design (missing)
<!-- /auto -->

## Log

- 2026-10-04 · registered (Grind 75)
