---
id: sorting/03
title: Chart positions
concept: sorting
---
# Chart positions

## Statement

`plays[i]` is how many times song `i` was played this week 🎧. A song's chart position is `1` plus the number of **different** play counts that are higher than its own: the most played songs are at position 1, songs with the same count share a position, and the next lower count takes the next position, with no gaps. Return the position of every song, in the original order of `plays`.

**Examples**

- `plays = [50,80,50,20]` → `[2,1,2,3]`
- `plays = [7,7,7]` → `[1,1,1]`
- `plays = [5]` → `[1]`

**Constraints:** `0 <= plays.length <= 10^5` · `0 <= plays[i] <= 10^9`
