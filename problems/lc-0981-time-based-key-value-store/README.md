---
id: lc-0981
title: Time Based Key-Value Store
source: leetcode
url: https://leetcode.com/problems/time-based-key-value-store/
difficulty: medium
patterns: [binary-search]
concepts: [hash-map, binary-search, class-design]
lists: [grind-75]
status: todo
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 981. Time Based Key-Value Store

## Statement

Design a key-value store called `TimeMap` where each key can hold several values recorded at different timestamps. `set(key, value, timestamp)` records a value for a key at a given time. `get(key, timestamp)` returns the value stored for that key at the largest recorded timestamp that is not greater than the given one, or an empty string if no such record exists.

**Examples**

- `["TimeMap", "set", "get", "get", "set", "get", "get"]`, `[[], ["foo", "bar", 1], ["foo", 1], ["foo", 3], ["foo", "bar2", 4], ["foo", 4], ["foo", 5]]` → `[null, null, "bar", "bar", null, "bar2", "bar2"]`

**Constraints:** `1 <= key.length, value.length <= 100` · `key` and `value` consist of lowercase English letters and digits · `1 <= timestamp <= 10^7` · every call to `set` uses a timestamp strictly greater than the one before it · at most `2 * 10^5` calls will be made to `set` and `get`

## Concepts

<!-- auto:concepts -->
- [Hash map](../../concepts/hash-map/README.md) · learning
- binary-search (missing)
- class-design (missing)
<!-- /auto -->

## Log

- 2026-10-04 · registered (Grind 75)
