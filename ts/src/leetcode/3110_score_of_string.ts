function scoreOfString(s: string): number {
  let score = 0;

  for (let i = 1; i < s.length; i++) {
    const sum = s.charCodeAt(i) - s.charCodeAt(i - 1);
    score += Math.abs(sum);
  }

  return score;
}

export default scoreOfString;
