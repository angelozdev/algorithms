---
id: lc-2181
title: Merge Nodes in Between Zeros
source: leetcode
url: https://leetcode.com/problems/merge-nodes-in-between-zeros/
difficulty: medium
patterns: [linked-list]
concepts: [linked-list, two-pointers]
status: solving
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 2181. Merge Nodes in Between Zeros

## Statement

A linked list starts and ends with a node of value `0`, and no two zeros are adjacent. Replace every run of nodes between two consecutive zeros with a single node holding their sum, drop all the zeros, and return the head of the new list.

**Examples**

- `head = [0,3,1,0,4,5,2,0]` → `[4,11]`
- `head = [0,1,0,3,0,2,2,0]` → `[1,3,4]`

**Constraints:** `3 <= number of nodes <= 2 * 10^5` · `0 <= Node.val <= 1000` · no two consecutive zeros · the first and last nodes are `0`

## Concepts

<!-- auto:concepts -->
- linked-list (missing)
- [Two pointers](../../concepts/two-pointers/README.md) · learning
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
- 2026-09-27 · migration check: ts fails examples
