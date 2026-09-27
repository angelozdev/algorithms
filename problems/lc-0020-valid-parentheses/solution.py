class Solution:
    def isValid(self, s: str) -> bool:
        dic = {
            "(": ")",
            "[": "]",
            "{": "}"
        }

        stack = []
        for c in s:
            if c in dic:
                stack.append(dic[c])
                continue;

            if len(stack) == 0:
                return False

            d = stack.pop()
            if d != c:
                return False

        return len(stack) == 0
