import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiClient } from '../api-client.js';

export function registerPipelineTools(server: McpServer) {
  server.tool(
    'crm_list_pipelines',
    'List all pipelines',
    {},
    async () => {
      try {
        const { data } = await apiClient.get('/pipelines');
        const pipelines = Array.isArray(data) ? data : data.pipelines || data.data || [];
        if (pipelines.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No pipelines found.' }] };
        }
        const text = pipelines
          .map((p: any, i: number) => {
            const statuses = p.statuses?.map((s: any) => s.name).join(' > ') || '';
            return [
              `${i + 1}. ${p.name} (ID: ${p.id})`,
              p.description ? `   ${p.description}` : null,
              statuses ? `   Stages: ${statuses}` : null,
            ]
              .filter(Boolean)
              .join('\n');
          })
          .join('\n\n');
        return { content: [{ type: 'text' as const, text: `Pipelines (${pipelines.length}):\n\n${text}` }] };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: `Error listing pipelines: ${e.response?.data?.message || e.message}` }] };
      }
    },
  );

  server.tool(
    'crm_create_pipeline',
    'Create a new pipeline',
    {
      name: z.string().describe('Pipeline name'),
      description: z.string().optional().describe('Pipeline description'),
    },
    async (params) => {
      try {
        const { data: pipeline } = await apiClient.post('/pipelines', params);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Pipeline created!\nID: ${pipeline.id}\nName: ${pipeline.name}${pipeline.description ? `\nDescription: ${pipeline.description}` : ''}`,
            },
          ],
        };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: `Error creating pipeline: ${e.response?.data?.message || e.message}` }] };
      }
    },
  );

  server.tool(
    'crm_get_pipeline',
    'Get details of a specific pipeline including its stages',
    {
      pipelineId: z.string().describe('Pipeline ID'),
    },
    async ({ pipelineId }) => {
      try {
        const { data: pipeline } = await apiClient.get(`/pipelines/${pipelineId}`);
        const statuses = pipeline.statuses || [];
        const text = [
          `Pipeline: ${pipeline.name}`,
          `ID: ${pipeline.id}`,
          pipeline.description ? `Description: ${pipeline.description}` : null,
          statuses.length
            ? `\nStages (${statuses.length}):\n${statuses.map((s: any, i: number) => `  ${i + 1}. ${s.name} (ID: ${s.id})${s.leadsCount != null ? ` — ${s.leadsCount} leads` : ''}`).join('\n')}`
            : 'No stages configured.',
        ]
          .filter(Boolean)
          .join('\n');
        return { content: [{ type: 'text' as const, text }] };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: `Error getting pipeline: ${e.response?.data?.message || e.message}` }] };
      }
    },
  );
}
