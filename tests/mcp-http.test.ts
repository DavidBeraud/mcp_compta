import { afterEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createAccountingMcpHttpServer } from '../src/mcp/http-server.js';

describe('authenticated loopback MCP server', () => {
  const closers: Array<() => Promise<void>> = [];
  afterEach(async () => { await Promise.all(closers.splice(0).map(close => close())); });

  async function start() {
    const app = createAccountingMcpHttpServer({ token: 'a'.repeat(48), port: 0 });
    await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const address = app.server.address(); if (!address || typeof address === 'string') throw new Error('Missing test address');
    closers.push(() => new Promise(resolve => app.server.close(() => resolve())));
    return `http://127.0.0.1:${address.port}`;
  }

  it('rejects a non-loopback bind and protects MCP while exposing a versioned healthcheck', async () => {
    expect(() => createAccountingMcpHttpServer({ token: 'a'.repeat(48), host: '0.0.0.0' })).toThrow(/127\.0\.0\.1/);
    const base = await start();
    const health = await fetch(`${base}/healthz`);
    expect(await health.json()).toEqual({ status: 'ok', name: 'accounting-core-fr', version: '1.1.0' });
    const denied = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(denied.status).toBe(401);
  });

  it('uses MCP tools and returns deterministic invoice results from the core', async () => {
    const base = await start();
    const client = new Client({ name: 'atlas-finances-test', version: '1.0.0' });
    closers.push(() => client.close());
    const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${'a'.repeat(48)}` } } });
    await client.connect(transport);
    expect(client.getServerVersion()).toMatchObject({ name: 'accounting-core-fr', version: '1.1.0' });
    const tools = await client.listTools();
    expect(tools.tools.map(tool => tool.name)).toContain('calculate_invoice');
    const result = await client.callTool({ name: 'calculate_invoice', arguments: { input: {
      type: 'QUOTE', profile: 'FR_GENERAL', transactionDate: '2026-09-26', currency: 'EUR',
      lines: [{ id: 'line-1', description: 'Travaux', quantity: '2', unitPriceExVat: '100.00', vatTreatment: 'STANDARD', vatRate: '20' }]
    } } });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ result: 'VALID', calculations: { totalExVat: '200.00', totalVat: '40.00', totalInclVat: '240.00' } });
  });
});
