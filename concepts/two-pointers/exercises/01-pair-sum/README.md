---
id: two-pointers/01
title: Pair sum
concept: two-pointers
status: solved
hints: 1
solution_revealed: false
solved_in: [ts]
---
# Pair sum

## Statement

`nums` is sorted in non-decreasing order. Return `true` if two elements at **different positions** add up to `target`, and `false` otherwise.

**Examples**

- `nums = [1,3,4,6,9], target = 10` → `true` (`1 + 9`, or `4 + 6`)
- `nums = [1,2,5,8], target = 4` → `false` (there is only one `2`)
- `nums = [3,3], target = 6` → `true` (same value, different positions)

**Constraints:** `0 <= nums.length <= 10^5` · `-10^9 <= nums[i] <= 10^9` · `-2 * 10^9 <= target <= 2 * 10^9` · `nums` is sorted in non-decreasing order

**Follow-up:** solve it with O(1) extra memory (no set, no dict, no Map).

## Log

- 2026-09-28 · created
- 2026-09-28 · green in ts, O(n) time, O(n) space → better exists (O(1) space)
- 2026-09-28 · hint 1
