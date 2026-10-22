// 单一来源：MCP 客户端 clientInfo 与 MCP Server serverInfo 都用它
// 写成常量而不是读 package.json：网页也会经 providers.js → mcp.js 加载本文件，浏览器里没有 node:fs
// 发版时与 package.json 一起改，test/version.test.js 会检查两者一致
export const VERSION = '0.2.2';
