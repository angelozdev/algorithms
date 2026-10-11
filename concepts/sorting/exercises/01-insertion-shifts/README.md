---
id: sorting/01
title: Insertion shifts
concept: sorting
---
# Insertion shifts

## Statement

Insertion sort walks through `nums` from left to right. Each element slides to the left, one slot at a time, past every **bigger** element before it (it never passes an equal one), until the part on its left is sorted. Return how many one-slot slides insertion sort makes in total to sort `nums` in non-decreasing order.

**Examples**

- `nums = [5,2,4,1]` → `5` (2 passes 5; 4 passes 5; 1 passes 5, 4 and 2)
- `nums = [1,2,3]` → `0`
- `nums = [3,3,1]` → `2`

**Constraints:** `0 <= nums.length <= 2000` · `-10^9 <= nums[i] <= 10^9`
