class Solution:
    def lengthOfLastWord(self, s: str) -> int:
        l = 0

        for i in range(len(s)):
            c = s[-(i + 1)]
            if c == " ":
                if l > 0:
                    return l
            else:
                l += 1
        return l


sol = Solution()
s = "Hello World"
print(sol.lengthOfLastWord(s))
