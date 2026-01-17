class Solution:
    def isPalindrome(self, x: int) -> bool:
        if x < 0:
            return False

        original = x
        reversed_num = 0

        while x > 0:
            reversed_num = reversed_num * 10 + x % 10
            x //= 10

        return original == reversed_num


if __name__ == "__main__":
    solution = Solution()
    assert solution.isPalindrome(121)
    assert not solution.isPalindrome(-121)
    assert not solution.isPalindrome(10)
