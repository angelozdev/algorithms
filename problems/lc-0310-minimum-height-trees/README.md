---
id: lc-0310
title: Minimum Height Trees
source: leetcode
url: https://leetcode.com/problems/minimum-height-trees/
difficulty: medium
patterns: [graphs]
concepts: [graph-bfs, topological-sort]
lists: [grind-75]
status: todo
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 310. Minimum Height Trees

## Statement

You're given a tree of `n` nodes labeled `0` to `n - 1`, described by its `n - 1` undirected `edges`. Picking any node as the root gives a rooted tree whose height is the longest edge-count from that root down to a leaf. Return every node label that, when chosen as root, produces one of the smallest possible heights, in any order.

**Examples**

- `n = 4, edges = [[1,0],[1,2],[1,3]]` → `[1]`
- `n = 6, edges = [[3,0],[3,1],[3,2],[3,4],[5,4]]` → `[3,4]`

**Constraints:** `1 <= n <= 2 * 10^4` · `edges.length == n - 1` · `0 <= a_i, b_i < n` · `a_i != b_i` · all the pairs `(a_i, b_i)` are distinct · the input is guaranteed to form a tree with no repeated edges

## Concepts

<!-- auto:concepts -->
- graph-bfs (missing)
- topological-sort (missing)
<!-- /auto -->

## Log

- 2026-10-04 · registered (Grind 75)
