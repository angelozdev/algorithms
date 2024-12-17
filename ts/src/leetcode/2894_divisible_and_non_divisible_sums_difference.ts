/**
 * Calculates the sum of all natural numbers up to `n`.
 * Formula: Sum = (n * (n + 1)) / 2
 * @param n - The upper limit for the summation.
 * @returns The sum of numbers from 1 to `n`.
 */
function sumUpTo(n: number): number {
  return (n * (n + 1)) / 2;
}

/**
 * Computes the difference between:
 * - The sum of the first `n` natural numbers.
 * - The sum of all multiples of `m` up to `n`.
 * @param n - The upper limit for the total summation.
 * @param m - The factor whose multiples are summed.
 * @returns The difference between the total sum and the multiples sum.
 */
function differenceOfSums(n: number, m: number): number {
  const totalSum = sumUpTo(n);
  const multiplesCount = Math.trunc(n / m);
  const multiplesSum = m * sumUpTo(multiplesCount) * 2;

  return totalSum - multiplesSum;
}

export default differenceOfSums;
