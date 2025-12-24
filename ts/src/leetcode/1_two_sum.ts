function twoSum(nums: number[], target: number): number[] {
  const seen: Map<number, number> = new Map();

  for (let i = 0; i < nums.length; i++) {
    const num = nums[i];
    const complement = target - num;
    if (seen.get(complement) !== undefined) {
      return [seen.get(complement)!, i];
    }
    seen.set(num, i);
  }

  throw new Error("No two sum solution found");
}

console.log(twoSum([2, 7, 11, 15], 9)); // [0, 1] -> 2 + 7 = 9
console.log(twoSum([3, 2, 4], 6)); // [1, 2] -> 2 + 4 = 6
console.log(twoSum([3, 3], 6)); // [0, 1] -> 3 + 3 = 6
console.log(twoSum([2, 7, 11, 15], 18)); // [1, 2] -> 7 + 11 = 18
console.log(twoSum([2, 7, 11, 15], 22)); // [1, 3] -> 7 + 15 = 22
console.log(twoSum([2, 7, 11, 15], 26)); // [2, 3] -> 11 + 15 = 26
