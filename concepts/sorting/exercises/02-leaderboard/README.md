---
id: sorting/02
title: Leaderboard
concept: sorting
---
# Leaderboard

## Statement

After a hackathon 🏆, `names[i]` scored `scores[i]` points. Return the names in leaderboard order: higher scores first, and names with the same score in alphabetical order.

**Examples**

- `names = ["ana","bo","cy"], scores = [3,7,3]` → `["bo","ana","cy"]`
- `names = ["zed","amy"], scores = [5,5]` → `["amy","zed"]`
- `names = ["solo"], scores = [0]` → `["solo"]`

**Constraints:** `1 <= names.length == scores.length <= 10^5` · names are distinct, with 1 to 10 lowercase English letters · `-10^9 <= scores[i] <= 10^9`
