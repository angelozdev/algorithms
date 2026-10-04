---
id: lc-0057
title: Insert Interval
source: leetcode
url: https://leetcode.com/problems/insert-interval/
difficulty: medium
patterns: [intervals]
concepts: [intervals]
lists: [grind-75]
status: todo
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 57. Insert Interval

## Statement

You're given a list of intervals that are already sorted by start value and don't overlap each other, plus one extra interval to add. Insert that new interval into the list, combining it with any interval it overlaps (sharing at least one point), and return the full list — still sorted by start value, with no overlaps left.

**Examples**

- `intervals = [[1,3],[6,9]], newInterval = [2,5]` → `[[1,5],[6,9]]`
- `intervals = [[1,2],[3,5],[6,7],[8,10],[12,16]], newInterval = [4,8]` → `[[1,2],[3,10],[12,16]]`

**Constraints:** `0 <= intervals.length <= 10^4` · `intervals[i].length == 2` · `0 <= start_i <= end_i <= 10^5` · `intervals` arrives sorted by `start_i` and has no overlaps · `newInterval.length == 2` · `0 <= start <= end <= 10^5`

## Concepts

<!-- auto:concepts -->
- intervals (missing)
<!-- /auto -->

## Log

- 2026-10-04 · registered (Grind 75)
