---
id: lc-0208
title: "Implement Trie (Prefix Tree)"
source: leetcode
url: https://leetcode.com/problems/implement-trie-prefix-tree/
difficulty: medium
patterns: [tries]
concepts: [trie, class-design]
lists: [grind-75]
status: todo
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 208. Implement Trie (Prefix Tree)

## Statement

Build a `Trie` class that stores a growing set of words, letter by letter. `insert(word)` adds a word to the structure. `search(word)` reports whether that exact word was previously inserted, and `startsWith(prefix)` reports whether any inserted word begins with that prefix.

**Examples**

- `["Trie", "insert", "search", "search", "startsWith", "insert", "search"]`, `[[], ["apple"], ["apple"], ["app"], ["app"], ["app"], ["app"]]` → `[null, null, true, false, true, null, true]`

**Constraints:** `1 <= word.length, prefix.length <= 2000` · `word` and `prefix` consist only of lowercase English letters · at most `3 * 10^4` calls in total will be made to `insert`, `search`, and `startsWith`

## Concepts

<!-- auto:concepts -->
- trie (missing)
- class-design (missing)
<!-- /auto -->

## Log

- 2026-10-04 · registered (Grind 75)
