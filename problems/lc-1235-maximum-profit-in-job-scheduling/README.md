---
id: lc-1235
title: Maximum Profit in Job Scheduling
source: leetcode
url: https://leetcode.com/problems/maximum-profit-in-job-scheduling/
difficulty: hard
patterns: [dp-1d]
concepts: [dynamic-programming, binary-search, sorting]
lists: [grind-75]
status: todo
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 1235. Maximum Profit in Job Scheduling

## Statement

You're given `n` jobs as three parallel arrays `startTime`, `endTime` and `profit`: job `i` runs from `startTime[i]` to `endTime[i]` and pays `profit[i]`. Choose a subset of jobs with no two overlapping in time, and return the largest total profit that subset can earn. A job that ends exactly when another begins does not count as overlapping.

**Examples**

- `startTime = [1,2,3,3], endTime = [3,4,5,6], profit = [50,10,40,70]` → `120` (jobs 1 and 4: `[1-3]` + `[3-6]`, `50 + 70`)
- `startTime = [1,2,3,4,6], endTime = [3,5,10,6,9], profit = [20,20,100,70,60]` → `150` (jobs 1, 4 and 5: `20 + 70 + 60`)
- `startTime = [1,1,1], endTime = [2,3,4], profit = [5,6,4]` → `6`

**Constraints:** `1 <= startTime.length == endTime.length == profit.length <= 5 * 10^4` · `1 <= startTime[i] < endTime[i] <= 10^9` · `1 <= profit[i] <= 10^4`

## Concepts

<!-- auto:concepts -->
- dynamic-programming (missing)
- binary-search (missing)
- sorting (missing)
<!-- /auto -->

## Log

- 2026-10-04 · registered (Grind 75)
