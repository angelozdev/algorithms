---
id: lc-0621
title: Task Scheduler
source: leetcode
url: https://leetcode.com/problems/task-scheduler/
difficulty: medium
patterns: [greedy]
concepts: [greedy, frequency-counting]
lists: [grind-75]
status: todo
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 621. Task Scheduler

## Statement

You're given a list of CPU tasks, each identified by an uppercase letter, and a cooldown number `n`. Every interval the CPU either runs one task or sits idle, and a task with a given label can't run again until at least `n` other intervals (idle or not) have passed since its last run. Tasks may run in any order as long as that cooldown is respected. Return the minimum total number of intervals needed to run every task.

**Examples**

- `tasks = ["A","A","A","B","B","B"], n = 2` → `8`
- `tasks = ["A","C","A","B","D","B"], n = 1` → `6`
- `tasks = ["A","A","A","B","B","B"], n = 3` → `10`

**Constraints:** `1 <= tasks.length <= 10^4` · `tasks[i]` is an uppercase English letter · `0 <= n <= 100`

## Concepts

<!-- auto:concepts -->
- greedy (missing)
- frequency-counting (missing)
<!-- /auto -->

## Log

- 2026-10-04 · registered (Grind 75)
