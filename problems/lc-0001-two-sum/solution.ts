export default function twoSum(nums: number[], target: number): number[] {
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
