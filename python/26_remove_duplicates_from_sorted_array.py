class Solution(object):
    def removeDuplicates(self, nums: list[int]):
        """
        :type nums: List[int]
        :rtype: int
        """
        head = 0

        for i, n in enumerate(nums):
            if n > nums[head]:
                head = head + 1
                nums[i], nums[head] = nums[head], nums[i]

        return nums


sol = Solution()
print(sol.removeDuplicates([0, 0, 1, 1, 1, 2, 2, 3, 3, 4]))
