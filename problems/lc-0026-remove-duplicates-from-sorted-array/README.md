---
id: lc-0026
title: Remove Duplicates from Sorted Array
source: leetcode
url: https://leetcode.com/problems/remove-duplicates-from-sorted-array/
difficulty: easy
patterns: [two-pointers]
concepts: [two-pointers, in-place-array-modification]
status: solving
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 26. Remove Duplicates from Sorted Array

## Statement

`nums` is sorted in non-decreasing order. Remove the duplicates **in place** so that each unique value appears only once, keeping their relative order, and return `k`, the number of unique values. The judge checks that the first `k` elements of `nums` hold the unique values in order; whatever comes after position `k` is ignored.

**Examples**

- `nums = [1,1,2]` → `2, nums = [1,2,_]`
- `nums = [0,0,1,1,1,2,2,3,3,4]` → `5, nums = [0,1,2,3,4,_,_,_,_,_]`

**Constraints:** `1 <= nums.length <= 3 * 10^4` · `-100 <= nums[i] <= 100` · `nums` is sorted in non-decreasing order

## Concepts

<!-- auto:concepts -->
- two-pointers (missing)
- in-place-array-modification (missing)
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
- 2026-09-27 · migration check: py fails examples
