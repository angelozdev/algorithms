class Solution:
    def searchInsert(self, nums: list[int], target: int) -> int:
        left = 0
        mid = len(nums) // 2
        right = len(nums) - 1
        print("l=", nums[left], "mid=", nums[mid], "r=", nums[right], "target=", target)

        if nums[mid] == target:
            return mid

        if mid >= right:
            return mid

        if nums[mid] < target:
            return self.searchInsert(nums[mid:right], target)
        else:
            return self.searchInsert(nums[left:mid], target)


sol = Solution()
nums = list(range(1_000))
print(sol.searchInsert(nums, 80))
