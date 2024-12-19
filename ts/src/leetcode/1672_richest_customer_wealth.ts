function maximumWealth(accounts: number[][]): number {
  let maxWealth = 0;

  for (const customer of accounts) {
    const customerWealth = customer.reduce((sum, bank) => sum + bank, 0);
    if (customerWealth > maxWealth) maxWealth = customerWealth;
  }

  return maxWealth;
}

export default maximumWealth;
