function buildArray(nums: number[]): number[] {
  const n = nums.length;

  for (let i = 0; i < n; i++) {
    const a = nums[i];
    const b = nums[a] % n;

    nums[i] = b * n + a;
  }

  for (let i = 0; i < n; i++) {
    nums[i] = Math.trunc(nums[i] / n);
  }

  return nums;
}

export default buildArray;
