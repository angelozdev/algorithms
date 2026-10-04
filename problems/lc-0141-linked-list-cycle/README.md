---
id: lc-0141
title: Linked List Cycle
source: leetcode
url: https://leetcode.com/problems/linked-list-cycle/
difficulty: easy
patterns: [linked-list]
concepts: [linked-list, fast-slow-pointers]
lists: [grind-75]
status: todo
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 141. Linked List Cycle

## Statement

Given the head of a singly linked list, decide whether the list loops back on itself: some node's `next` pointer eventually points to a node visited earlier in the traversal. The grader builds this cycle internally from a hidden index telling it which earlier node the tail connects to (or that there is no such connection); that index is never part of your function's input. Return `true` when such a cycle exists and `false` when the list simply ends in `null`.

**Examples**

- `head = [3,2,0,-4], pos = 1` → `true`
- `head = [1,2], pos = 0` → `true`
- `head = [1], pos = -1` → `false`

**Constraints:** the number of nodes is in `[0, 10^4]` · `-10^5 <= Node.val <= 10^5` · `pos` is `-1` or a valid index

## Concepts

<!-- auto:concepts -->
- linked-list (missing)
- fast-slow-pointers (missing)
<!-- /auto -->

## Log

- 2026-10-04 · registered (Grind 75)
