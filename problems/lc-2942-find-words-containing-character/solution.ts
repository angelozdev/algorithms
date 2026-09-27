function findWordsContaining(words: string[], x: string): number[] {
  const result = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word.includes(x)) result.push(i);
  }

  return result;
}

export default findWordsContaining;
