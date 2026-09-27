"""LeetCode-style node classes. Solutions import them with `from lc import ListNode`."""

from __future__ import annotations


class ListNode:
    def __init__(self, val: int = 0, next: ListNode | None = None) -> None:
        self.val = val
        self.next = next

    def __repr__(self) -> str:
        values: list[str] = []
        node: ListNode | None = self
        while node is not None and len(values) < 20:
            values.append(repr(node.val))
            node = node.next
        tail = " -> …" if node is not None else ""
        return f"ListNode({' -> '.join(values)}{tail})"


class TreeNode:
    def __init__(
        self,
        val: int = 0,
        left: TreeNode | None = None,
        right: TreeNode | None = None,
    ) -> None:
        self.val = val
        self.left = left
        self.right = right

    def __repr__(self) -> str:
        return f"TreeNode({self.val!r})"
