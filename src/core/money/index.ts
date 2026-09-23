import { Decimal } from 'decimal.js';

Decimal.set({ precision: 34, rounding: Decimal.ROUND_HALF_UP });
export type MoneyInput = string | number | Decimal;
export const decimal = (value: MoneyInput): Decimal => new Decimal(value);
export const roundMoney = (value: MoneyInput, scale = 2): Decimal => decimal(value).toDecimalPlaces(scale, Decimal.ROUND_HALF_UP);
export const money = (value: MoneyInput): string => roundMoney(value).toFixed(2);
export const rate = (value: MoneyInput): Decimal => decimal(value);
export const sum = (values: MoneyInput[]): Decimal => values.reduce<Decimal>((total, value) => total.plus(value), new Decimal(0));
export const assertNonNegative = (value: MoneyInput, field: string): void => {
  if (decimal(value).isNegative()) throw new Error(`${field} must be non-negative`);
};
