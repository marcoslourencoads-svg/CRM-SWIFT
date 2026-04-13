/**
 * Format a value in cents to BRL currency string.
 * Example: 150000 → "R$ 1.500,00"
 */
export function formatCurrency(cents: number): string {
  const value = cents / 100;
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
