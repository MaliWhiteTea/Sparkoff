export type OpenLoan = { quantity: string; returnedQuantity: string; status: string };

const thousandths = (value: string | number) => Math.round(Number(value) * 1000);

export function availableQuantity(kind: string, quantity: string, openLoans: OpenLoan[] = []): string {
  const inUse = kind === 'equipment'
    ? openLoans.filter(loan => loan.status === 'open' || loan.status === 'partial')
      .reduce((sum, loan) => sum + Math.max(0, thousandths(loan.quantity) - thousandths(loan.returnedQuantity)), 0)
    : 0;
  return (Math.max(0, thousandths(quantity) - inUse) / 1000).toFixed(3);
}
