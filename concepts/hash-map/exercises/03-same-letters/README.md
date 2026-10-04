---
id: hash-map/03
title: Same letters
concept: hash-map
status: todo
hints: 0
solution_revealed: false
solved_in: []
---
# Same letters

## Statement

Given a list of `words`, group together every word that uses exactly the same letters as another, each letter the same number of times (so the words in a group are rearrangements of each other). Return the groups: both the order of the groups and the order of the words inside each group can be anything.

**Examples**

- `words = ["eat","tea","tan","ate","nat","bat"]` → `[["eat","tea","ate"],["tan","nat"],["bat"]]`
- `words = ["a"]` → `[["a"]]`
- `words = [""]` → `[[""]]`

**Constraints:** `1 <= words.length <= 10^5` · `0 <= words[i].length <= 100` · lowercase English letters

## Log

- 2026-09-27 · created
- 2026-10-04 · statement reworded: the previous version (a two-string anagram check) was isomorphic to problems/lc-0242-valid-anagram
