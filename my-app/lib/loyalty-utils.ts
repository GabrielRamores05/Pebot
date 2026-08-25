export function normalizeMemberName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function findOrCreateCardData(customerName: string, categoryId: number | null) {
  return {
    customerName: normalizeMemberName(customerName),
    categoryId,
  };
}
