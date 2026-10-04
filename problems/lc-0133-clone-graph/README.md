---
id: lc-0133
title: Clone Graph
source: leetcode
url: https://leetcode.com/problems/clone-graph/
difficulty: medium
patterns: [graphs]
concepts: [graph-dfs, hash-map]
lists: [grind-75]
status: todo
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 133. Clone Graph

## Statement

You're given a reference to one node of a connected, undirected graph, where every node holds an integer value and a list of its neighbor nodes. Produce a deep copy of the whole graph — new node objects that mirror the original graph's structure and values — and return the clone of the given starting node. Test inputs describe the graph as an adjacency list indexed by each node's value (node `i` is 1-indexed), and the given starting node always has value `1`.

**Examples**

- `adjList = [[2,4],[1,3],[2,4],[1,3]]` → `[[2,4],[1,3],[2,4],[1,3]]`
- `adjList = [[]]` → `[[]]`
- `adjList = []` → `[]`

**Constraints:** the number of nodes is in `[0, 100]` · `1 <= Node.val <= 100`, unique per node · no repeated edges and no self-loops · the graph is connected and every node is reachable from the given one

## Concepts

<!-- auto:concepts -->
- graph-dfs (missing)
- [Hash map](../../concepts/hash-map/README.md) · learning
<!-- /auto -->

## Log

- 2026-10-04 · registered (Grind 75)
