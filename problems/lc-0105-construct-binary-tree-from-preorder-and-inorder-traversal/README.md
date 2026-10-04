---
id: lc-0105
title: Construct Binary Tree from Preorder and Inorder Traversal
source: leetcode
url: https://leetcode.com/problems/construct-binary-tree-from-preorder-and-inorder-traversal/
difficulty: medium
patterns: [trees]
concepts: [binary-tree, divide-and-conquer, hash-map]
lists: [grind-75]
status: todo
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 105. Construct Binary Tree from Preorder and Inorder Traversal

## Statement

You're given two integer arrays describing the same binary tree: one lists its nodes in preorder, the other in inorder. Every node value in the tree is distinct. Rebuild the tree from these two traversals and return its root.

**Examples**

- `preorder = [3,9,20,15,7], inorder = [9,3,15,20,7]` → `[3,9,20,null,null,15,7]`
- `preorder = [-1], inorder = [-1]` → `[-1]`

**Constraints:** `1 <= preorder.length <= 3000` · `inorder.length == preorder.length` · `-3000 <= preorder[i], inorder[i] <= 3000` · `preorder` and `inorder` consist of unique values · every value of `inorder` also appears in `preorder` · `preorder` is guaranteed to be the preorder traversal of the tree · `inorder` is guaranteed to be the inorder traversal of the tree

## Concepts

<!-- auto:concepts -->
- binary-tree (missing)
- divide-and-conquer (missing)
- [Hash map](../../concepts/hash-map/README.md) · learning
<!-- /auto -->

## Log

- 2026-10-04 · registered (Grind 75)
