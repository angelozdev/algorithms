---
id: lc-0008
title: String to Integer (atoi)
source: leetcode
url: https://leetcode.com/problems/string-to-integer-atoi/
difficulty: medium
patterns: [strings]
concepts: [string-parsing]
lists: [grind-75]
status: todo
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 8. String to Integer (atoi)

## Statement

Implement a function that turns a string into a 32-bit signed integer, the way a classic `atoi`-style parser would. Skip any leading spaces, then read an optional `+` or `-` sign, then read as many digits as follow and stop at the first non-digit character (or the end of the string). If no digits were found at all, the answer is `0`; otherwise clamp the parsed number to the 32-bit signed range `[-2^31, 2^31 - 1]`. You may not call a built-in string-to-number conversion function — do the parsing yourself.

**Examples**

- `s = "42"` → `42`
- `s = "   -042"` → `-42`
- `s = "1337c0d3"` → `1337`
- `s = "0-1"` → `0`
- `s = "words and 987"` → `0`

**Constraints:** `0 <= s.length <= 200` · `s` consists of English letters (upper and lower case), digits, `' '`, `'+'`, `'-'`, and `'.'`

## Concepts

<!-- auto:concepts -->
- string-parsing (missing)
<!-- /auto -->

## Log

- 2026-10-04 · registered (Grind 75)
