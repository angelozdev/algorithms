---
id: lc-0721
title: Accounts Merge
source: leetcode
url: https://leetcode.com/problems/accounts-merge/
difficulty: medium
patterns: [graphs]
concepts: [union-find, hash-map, sorting]
lists: [grind-75]
status: todo
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 721. Accounts Merge

## Statement

You're given a list of accounts, where each account is a name followed by the emails registered to it. Two accounts belong to the same person whenever they share at least one email, even transitively through a chain of shared emails, even though two different people may happen to share the same name. Merge every account into one per person, and return each merged account as the name followed by all of that person's emails in sorted order; the accounts themselves can come back in any order.

**Examples**

- `accounts = [["John","johnsmith@mail.com","john_newyork@mail.com"],["John","johnsmith@mail.com","john00@mail.com"],["Mary","mary@mail.com"],["John","johnnybravo@mail.com"]]` → `[["John","john00@mail.com","john_newyork@mail.com","johnsmith@mail.com"],["Mary","mary@mail.com"],["John","johnnybravo@mail.com"]]`
- `accounts = [["Gabe","Gabe0@m.co","Gabe3@m.co","Gabe1@m.co"],["Kevin","Kevin3@m.co","Kevin5@m.co","Kevin0@m.co"],["Ethan","Ethan5@m.co","Ethan4@m.co","Ethan0@m.co"],["Hanzo","Hanzo3@m.co","Hanzo1@m.co","Hanzo0@m.co"],["Fern","Fern5@m.co","Fern1@m.co","Fern0@m.co"]]` → `[["Ethan","Ethan0@m.co","Ethan4@m.co","Ethan5@m.co"],["Gabe","Gabe0@m.co","Gabe1@m.co","Gabe3@m.co"],["Hanzo","Hanzo0@m.co","Hanzo1@m.co","Hanzo3@m.co"],["Kevin","Kevin0@m.co","Kevin3@m.co","Kevin5@m.co"],["Fern","Fern0@m.co","Fern1@m.co","Fern5@m.co"]]`

**Constraints:** `1 <= accounts.length <= 1000` · `2 <= accounts[i].length <= 10` · `1 <= accounts[i][j].length <= 30` · `accounts[i][0]` consists of English letters · every `accounts[i][j]` for `j > 0` is a valid email

## Concepts

<!-- auto:concepts -->
- union-find (missing)
- [Hash map](../../concepts/hash-map/README.md) · learning
- sorting (missing)
<!-- /auto -->

## Log

- 2026-10-04 · registered (Grind 75)
