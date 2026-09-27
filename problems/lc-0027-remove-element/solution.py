class Solution:
    def removeElement(self, nums: list[int], val: int) -> int:
        k = 0

        for n in nums:
            if n != val:
                nums[k] = n
                k += 1

        return k


sol = Solution()
print(sol.removeElement([0, 1, 2, 2, 3, 0, 4, 2], 2))
