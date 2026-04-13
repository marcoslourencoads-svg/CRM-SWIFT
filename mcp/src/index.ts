import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerLeadTools } from './tools/leads.js';
import { registerPipelineTools } from './tools/pipelines.js';
import { registerDashboardTools } from './tools/dashboard.js';
import { registerTeamTools } from './tools/team.js';

const server = new McpServer({
  name: 'crm-jp',
  version: '0.0.1',
});

registerLeadTools(server);
registerPipelineTools(server);
registerDashboardTools(server);
registerTeamTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('CRM MCP Server running on stdio');
}

main().catch(console.error);
