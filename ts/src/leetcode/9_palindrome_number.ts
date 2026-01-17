import assert from "node:assert";

function isPalindrome(x: number): boolean {
  if (x < 0) return false;

  const original = x;
  let reversedNumber = 0;

  while (x > 0) {
    const lastNumber = x % 10;
    x = Math.floor(x / 10);
    reversedNumber = reversedNumber * 10 + lastNumber;
  }

  return original === reversedNumber;
}

assert.equal(isPalindrome(121), true);
assert.equal(isPalindrome(-121), false);
assert.equal(isPalindrome(10), false);
