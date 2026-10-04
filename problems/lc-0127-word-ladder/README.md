---
id: lc-0127
title: Word Ladder
source: leetcode
url: https://leetcode.com/problems/word-ladder/
difficulty: hard
patterns: [graphs]
concepts: [graph-bfs, hash-set]
lists: [grind-75]
status: todo
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 127. Word Ladder

## Statement

You're given `beginWord`, `endWord`, and a `wordList`. A transformation sequence changes one letter at a time, with every intermediate word (and `endWord`) required to appear in `wordList`; `beginWord` itself doesn't need to be there. Return the number of words in the shortest such sequence from `beginWord` to `endWord`, or `0` if none exists.

**Examples**

- `beginWord = "hit", endWord = "cog", wordList = ["hot","dot","dog","lot","log","cog"]` → `5`
- `beginWord = "hit", endWord = "cog", wordList = ["hot","dot","dog","lot","log"]` → `0`

**Constraints:** `1 <= beginWord.length <= 10` · `endWord.length == beginWord.length` · `1 <= wordList.length <= 5000` · `wordList[i].length == beginWord.length` · `beginWord`, `endWord` and every `wordList[i]` consist of lowercase English letters · `beginWord != endWord` · all the words in `wordList` are unique

## Concepts

<!-- auto:concepts -->
- graph-bfs (missing)
- hash-set (missing)
<!-- /auto -->

## Log

- 2026-10-04 · registered (Grind 75)
