---
id: lc-0207
title: Course Schedule
source: leetcode
url: https://leetcode.com/problems/course-schedule/
difficulty: medium
patterns: [graphs]
concepts: [graph-dfs, topological-sort]
lists: [grind-75]
status: todo
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 207. Course Schedule

## Statement

There are `numCourses` courses labeled `0` to `numCourses - 1`. Each pair `[a, b]` in `prerequisites` means you must take course `b` before course `a`. Given `numCourses` and the list of prerequisite pairs, return whether it's possible to finish every course.

**Examples**

- `numCourses = 2, prerequisites = [[1,0]]` → `true`
- `numCourses = 2, prerequisites = [[1,0],[0,1]]` → `false`

**Constraints:** `1 <= numCourses <= 2000` · `0 <= prerequisites.length <= 5000` · `prerequisites[i].length == 2` · `0 <= a_i, b_i < numCourses` · all the pairs `prerequisites[i]` are unique

## Concepts

<!-- auto:concepts -->
- graph-dfs (missing)
- topological-sort (missing)
<!-- /auto -->

## Log

- 2026-10-04 · registered (Grind 75)
