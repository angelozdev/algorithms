---
id: arrays-and-strings/01
title: Regroup
concept: arrays-and-strings
---
# Regroup

## Statement

A dashboard shows its widgets in rows; `grid[r]` is row `r`, and rows may have different lengths. The screen changes width 📱: lay out the same widgets again, in the same reading order (row by row, left to right), in rows of exactly `cols` widgets. Only the last row may be shorter. Return the new grid; it never contains an empty row.

**Examples**

- `grid = [[1,2,3],[4,5,6]], cols = 2` → `[[1,2],[3,4],[5,6]]`
- `grid = [[1,2],[3,4],[5]], cols = 4` → `[[1,2,3,4],[5]]`
- `grid = [[7]], cols = 3` → `[[7]]`

**Constraints:** `0 <= grid.length <= 10^5` · `0 <= grid[r].length` · at most `10^5` widgets in total · `1 <= cols <= 10^5` · `-10^9 <= grid[r][c] <= 10^9`
