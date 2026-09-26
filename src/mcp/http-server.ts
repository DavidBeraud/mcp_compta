#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ACCOUNTING_MCP_NAME, ACCOUNTING_MCP_VERSION, createAccountingMcpServer } from './tools.js';

export type AccountingMcpHttpOptions = { token: string; host?: string; port?: number };

function authorized(request: IncomingMessage, token: string) {
  const provided = request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
  const actual = Buffer.from(provided); const expected = Buffer.from(token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  response.end(JSON.stringify(body));
}

export function createAccountingMcpHttpServer({ token, host = '127.0.0.1', port = 8766 }: AccountingMcpHttpOptions) {
  if (host !== '127.0.0.1') throw new Error('Accounting MCP must bind to 127.0.0.1.');
  if (token.length < 32) throw new Error('ATLAS_COMPTA_MCP_TOKEN must contain at least 32 characters.');
  const app = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
    if (url.pathname === '/healthz' && request.method === 'GET') return json(response, 200, { status: 'ok', name: ACCOUNTING_MCP_NAME, version: ACCOUNTING_MCP_VERSION });
    if (url.pathname !== '/mcp') return json(response, 404, { error: 'not_found' });
    if (!authorized(request, token)) return json(response, 401, { error: 'unauthorized' });
    if (!['POST', 'GET', 'DELETE'].includes(request.method ?? '')) return json(response, 405, { error: 'method_not_allowed' });
    try {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      const server = createAccountingMcpServer();
      await server.connect(transport);
      response.on('close', () => { void transport.close(); void server.close(); });
      await transport.handleRequest(request, response);
    } catch (error) {
      if (!response.headersSent) json(response, 400, { error: error instanceof Error ? error.message : 'invalid_mcp_request' });
      else response.end();
    }
  });
  return { server: app, host, port };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const token = process.env.ATLAS_COMPTA_MCP_TOKEN ?? '';
  const host = process.env.ATLAS_COMPTA_MCP_HOST ?? '127.0.0.1';
  const port = Number(process.env.ATLAS_COMPTA_MCP_PORT ?? 8766);
  const app = createAccountingMcpHttpServer({ token, host, port });
  app.server.listen(app.port, app.host, () => process.stderr.write(`Accounting MCP listening on http://${app.host}:${app.port}/mcp\n`));
}
