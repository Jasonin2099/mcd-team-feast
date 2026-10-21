import { readFileSync } from 'node:fs';
// 单一来源：MCP 客户端 clientInfo 与 MCP Server serverInfo 都读 package.json
export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
