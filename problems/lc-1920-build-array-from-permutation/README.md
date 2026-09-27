---
id: lc-1920
title: Build Array from Permutation
source: leetcode
url: https://leetcode.com/problems/build-array-from-permutation/
difficulty: easy
patterns: [arrays-hashing]
concepts: [in-place-array-modification, modular-arithmetic]
status: solved
hints: 0
solution_revealed: false
solved_in: [ts]
complexity: null
---
# 1920. Build Array from Permutation

## Statement

`nums` is a permutation of `0 .. n-1`. Build and return the array `ans` where `ans[i] = nums[nums[i]]` for every `i`.

**Examples**

- `nums = [0,2,1,5,3,4]` → `[0,1,2,4,5,3]`
- `nums = [5,0,1,2,3,4]` → `[4,5,0,1,2,3]`

**Constraints:** `1 <= nums.length <= 1000` · `0 <= nums[i] < nums.length` · all values are distinct

**Follow-up:** Can you solve it with O(1) extra memory?

## Concepts

<!-- auto:concepts -->
- in-place-array-modification (missing)
- modular-arithmetic (missing)
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
- 2026-09-27 · migration check: green in ts
