import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createAccountingMcpServer } from './tools.js';

const server = createAccountingMcpServer();
await server.connect(new StdioServerTransport());
