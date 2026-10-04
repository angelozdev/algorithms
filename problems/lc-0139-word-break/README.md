---
id: lc-0139
title: Word Break
source: leetcode
url: https://leetcode.com/problems/word-break/
difficulty: medium
patterns: [dp-1d]
concepts: [dynamic-programming, hash-set]
lists: [grind-75]
status: todo
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 139. Word Break

## Statement

You're given a string `s` and a list of words `wordDict`. Return `true` if `s` can be split into a sequence of one or more space-separated pieces where every piece is a word from `wordDict`. A dictionary word may be reused as many times as needed in the split.

**Examples**

- `s = "leetcode", wordDict = ["leet","code"]` → `true` ("leet code")
- `s = "applepenapple", wordDict = ["apple","pen"]` → `true` ("apple pen apple")
- `s = "catsandog", wordDict = ["cats","dog","sand","and","cat"]` → `false`

**Constraints:** `1 <= s.length <= 300` · `1 <= wordDict.length <= 1000` · `1 <= wordDict[i].length <= 20` · `s` and every word in `wordDict` use only lowercase English letters · every word in `wordDict` is unique

## Concepts

<!-- auto:concepts -->
- dynamic-programming (missing)
- hash-set (missing)
<!-- /auto -->

## Log

- 2026-10-04 · registered (Grind 75)
