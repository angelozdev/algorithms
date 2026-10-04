---
id: lc-0146
title: LRU Cache
source: leetcode
url: https://leetcode.com/problems/lru-cache/
difficulty: medium
patterns: [linked-list]
concepts: [linked-list, hash-map, class-design]
lists: [grind-75]
status: todo
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 146. LRU Cache

## Statement

Design a cache, called `LRUCache`, that holds at most `capacity` key-value pairs. `get(key)` returns the stored value, or `-1` when the key is absent, and counts as a use of that key. `put(key, value)` stores or updates the pair and also counts as a use; if adding a brand-new key would push the cache past `capacity`, the least recently used pair is evicted first.

**Examples**

- `["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"]`, `[[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]]` → `[null, null, null, 1, null, -1, null, -1, 3, 4]`

**Constraints:** `1 <= capacity <= 3000` · `0 <= key <= 10^4` · `0 <= value <= 10^5` · at most `2 * 10^5` total calls to `get` and `put`

## Concepts

<!-- auto:concepts -->
- linked-list (missing)
- [Hash map](../../concepts/hash-map/README.md) · learning
- class-design (missing)
<!-- /auto -->

## Log

- 2026-10-04 · registered (Grind 75)
