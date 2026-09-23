import type { InvoiceInput, ProgressInput, RuleDecision } from '../domain/models.js';

export class AccountingClient {
  constructor(private readonly baseUrl: string, private readonly fetcher: typeof fetch = fetch) {}
  private async request<T>(path: string, body?: unknown): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) throw new Error(`Accounting API ${response.status}: ${await response.text()}`);
    return response.json() as Promise<T>;
  }
  invoice = { calculate: (input: InvoiceInput) => this.request('/v1/invoices/calculate', input), validate: (input: InvoiceInput) => this.request('/v1/invoices/validate', input), issue: (invoice: InvoiceInput, actorId: string, idempotencyKey: string) => this.request('/v1/invoices/issue', { invoice, actorId, idempotencyKey }) };
  creditNote = { calculate: (input: InvoiceInput) => this.request('/v1/credit-notes/calculate', input) };
  deposit = { calculate: (input: InvoiceInput) => this.request('/v1/deposits/calculate', input) };
  btp = { progress: { calculate: (input: ProgressInput) => this.request('/v1/btp/progress/calculate', input), validate: (input: ProgressInput) => this.request('/v1/btp/progress/validate', input) }, vat: { evaluate: (input: unknown) => this.request('/v1/btp/vat/evaluate', input) }, reverseCharge: { evaluate: (input: unknown) => this.request('/v1/btp/reverse-charge/evaluate', input) } };
  rules = { list: () => this.request('/v1/rules'), applicable: (input: unknown) => this.request('/v1/rules/applicable', input), explain: (decision: RuleDecision) => `${decision.result} — ${decision.reason} (${decision.ruleId}@${decision.ruleVersion})` };
}
export const createAccountingClient = (baseUrl: string, fetcher?: typeof fetch) => new AccountingClient(baseUrl, fetcher);
