/** "$" for USD, "€" for EUR… in the device's locale. */
export function currencySymbol(currency: string): string {
  const part = new Intl.NumberFormat(undefined, { style: 'currency', currency })
    .formatToParts(0)
    .find((p) => p.type === 'currency');
  return part?.value ?? currency;
}
