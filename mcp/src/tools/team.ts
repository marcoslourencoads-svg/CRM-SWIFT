import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../api-client.js';

export function registerTeamTools(server: McpServer) {
  server.tool(
    'crm_list_members',
    'List all team members',
    {},
    async () => {
      try {
        const { data } = await apiClient.get('/members');
        const members = Array.isArray(data) ? data : data.members || data.data || [];
        if (members.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No team members found.' }] };
        }
        const text = members
          .map((m: any, i: number) => {
            return [
              `${i + 1}. ${m.name} (ID: ${m.id})`,
              m.email ? `   Email: ${m.email}` : null,
              m.role ? `   Role: ${m.role}` : null,
            ]
              .filter(Boolean)
              .join('\n');
          })
          .join('\n\n');
        return { content: [{ type: 'text' as const, text: `Team Members (${members.length}):\n\n${text}` }] };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: `Error listing members: ${e.response?.data?.message || e.message}` }] };
      }
    },
  );
}
