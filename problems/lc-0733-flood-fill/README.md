---
id: lc-0733
title: Flood Fill
source: leetcode
url: https://leetcode.com/problems/flood-fill/
difficulty: easy
patterns: [graphs]
concepts: [matrix-traversal, graph-dfs]
lists: [grind-75]
status: todo
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 733. Flood Fill

## Statement

You're given a grid of pixel colors `image`, a starting cell `(sr, sc)`, and a new `color`. Starting from that cell, recolor it and spread the new color to every cell reachable through up/down/left/right neighbors that share the starting cell's original color, continuing outward from each newly recolored cell. Return the grid once no more matching neighbors remain.

**Examples**

- `image = [[1,1,1],[1,1,0],[1,0,1]], sr = 1, sc = 1, color = 2` → `[[2,2,2],[2,2,0],[2,0,1]]`
- `image = [[0,0,0],[0,0,0]], sr = 0, sc = 0, color = 0` → `[[0,0,0],[0,0,0]]`

**Constraints:** `m == image.length` · `n == image[i].length` · `1 <= m, n <= 50` · `0 <= image[i][j], color < 2^16` · `0 <= sr < m` · `0 <= sc < n`

## Concepts

<!-- auto:concepts -->
- matrix-traversal (missing)
- graph-dfs (missing)
<!-- /auto -->

## Log

- 2026-10-04 · registered (Grind 75)
