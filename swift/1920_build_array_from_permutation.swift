class Solution {
    func buildArray(_ nums: [Int]) -> [Int] {
       var nums = nums
        let n = nums.count

        for i in 0 ..< n {
            let a = nums[i]
            let b = nums[a] % n

            nums[i] += (b * n)
        }

        for i in 0 ..< n {
            nums[i] /= n
        }

        return nums
    }
}

let solution = Solution()
var nums = [5, 3, 0, 1, 2, 4]
print(solution.buildArray(nums))
