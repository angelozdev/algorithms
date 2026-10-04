---
id: lc-0027
title: Remove Element
source: leetcode
url: https://leetcode.com/problems/remove-element/
difficulty: easy
patterns: [two-pointers]
concepts: [two-pointers, in-place-array-modification]
status: solved
hints: 0
solution_revealed: false
solved_in: [py]
complexity: null
---
# 27. Remove Element

## Statement

Remove every occurrence of `val` from `nums` **in place** and return `k`, the number of elements different from `val`. The judge checks that the first `k` elements of `nums` are exactly those elements, in any order; whatever comes after position `k` is ignored.

**Examples**

- `nums = [3,2,2,3], val = 3` → `2, nums = [2,2,_,_]`
- `nums = [0,1,2,2,3,0,4,2], val = 2` → `5, nums = [0,1,4,0,3,_,_,_]` (any order)

**Constraints:** `0 <= nums.length <= 100` · `0 <= nums[i] <= 50` · `0 <= val <= 100`

## Concepts

<!-- auto:concepts -->
- [Two pointers](../../concepts/two-pointers/README.md) · learning
- in-place-array-modification (missing)
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
- 2026-09-27 · migration check: green in py
