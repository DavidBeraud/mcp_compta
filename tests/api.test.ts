import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/api/app.js';

describe('REST API', () => {
  it('exposes calculation and rules endpoints', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'POST', url: '/v1/invoices/calculate', payload: { type: 'STANDARD_INVOICE', profile: 'FR_GENERAL', transactionDate: '2026-08-27', currency: 'EUR', lines: [{ id: 'l', description: 'Test', quantity: '1', unitPriceExVat: '100', vatTreatment: 'STANDARD', vatRate: '20' }] } });
    expect(response.statusCode).toBe(200); expect(response.json().calculations.totalInclVat).toBe('120.00');
    const rules = await app.inject({ method: 'GET', url: '/v1/rules' }); expect(rules.json()).toHaveLength(72);
    await app.close();
  });
});
