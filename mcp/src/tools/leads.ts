import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiClient } from '../api-client.js';

export function registerLeadTools(server: McpServer) {
  server.tool(
    'crm_create_lead',
    'Create a new lead in a pipeline',
    {
      title: z.string().describe('Lead title'),
      pipelineId: z.string().describe('Pipeline ID'),
      contactName: z.string().optional().describe('Contact name'),
      contactEmail: z.string().optional().describe('Contact email'),
      companyName: z.string().optional().describe('Company name'),
      estimatedValue: z.number().optional().describe('Estimated deal value'),
    },
    async (params) => {
      try {
        const { pipelineId, ...body } = params;
        const { data } = await apiClient.post(`/pipelines/${pipelineId}/leads`, body);
        const lead = data;
        const text = [
          `Lead created successfully!`,
          `ID: ${lead.id}`,
          `Title: ${lead.title}`,
          lead.contactName ? `Contact: ${lead.contactName}` : null,
          lead.contactEmail ? `Email: ${lead.contactEmail}` : null,
          lead.companyName ? `Company: ${lead.companyName}` : null,
          lead.estimatedValue ? `Value: R$ ${lead.estimatedValue.toLocaleString()}` : null,
        ]
          .filter(Boolean)
          .join('\n');
        return { content: [{ type: 'text' as const, text }] };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: `Error creating lead: ${e.response?.data?.message || e.message}` }] };
      }
    },
  );

  server.tool(
    'crm_list_leads',
    'List leads in a pipeline with optional filters',
    {
      pipelineId: z.string().describe('Pipeline ID'),
      statusId: z.string().optional().describe('Filter by status ID'),
      assigneeId: z.string().optional().describe('Filter by assignee ID'),
      search: z.string().optional().describe('Search term'),
      limit: z.number().optional().describe('Max results to return'),
    },
    async (params) => {
      try {
        const { pipelineId, ...query } = params;
        const { data } = await apiClient.get(`/pipelines/${pipelineId}/leads`, { params: query });
        const leads = Array.isArray(data) ? data : data.leads || data.data || [];
        if (leads.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No leads found.' }] };
        }
        const text = leads
          .map((l: any, i: number) => {
            const parts = [
              `${i + 1}. ${l.title} (ID: ${l.id})`,
              l.status?.name ? `   Status: ${l.status.name}` : null,
              l.assignee?.name ? `   Assignee: ${l.assignee.name}` : null,
              l.contactName ? `   Contact: ${l.contactName}` : null,
              l.companyName ? `   Company: ${l.companyName}` : null,
              l.estimatedValue ? `   Value: R$ ${l.estimatedValue.toLocaleString()}` : null,
            ];
            return parts.filter(Boolean).join('\n');
          })
          .join('\n\n');
        return { content: [{ type: 'text' as const, text: `Found ${leads.length} lead(s):\n\n${text}` }] };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: `Error listing leads: ${e.response?.data?.message || e.message}` }] };
      }
    },
  );

  server.tool(
    'crm_get_lead',
    'Get details of a specific lead',
    {
      leadId: z.string().describe('Lead ID'),
    },
    async ({ leadId }) => {
      try {
        const { data: lead } = await apiClient.get(`/leads/${leadId}`);
        const text = [
          `Title: ${lead.title}`,
          `ID: ${lead.id}`,
          lead.status?.name ? `Status: ${lead.status.name}` : null,
          lead.pipeline?.name ? `Pipeline: ${lead.pipeline.name}` : null,
          lead.assignee?.name ? `Assignee: ${lead.assignee.name}` : null,
          lead.contactName ? `Contact: ${lead.contactName}` : null,
          lead.contactEmail ? `Email: ${lead.contactEmail}` : null,
          lead.companyName ? `Company: ${lead.companyName}` : null,
          lead.estimatedValue != null ? `Value: R$ ${lead.estimatedValue.toLocaleString()}` : null,
          lead.createdAt ? `Created: ${new Date(lead.createdAt).toLocaleDateString('pt-BR')}` : null,
          lead.notes?.length ? `\nNotes (${lead.notes.length}):\n${lead.notes.map((n: any) => `  - ${n.content}`).join('\n')}` : null,
        ]
          .filter(Boolean)
          .join('\n');
        return { content: [{ type: 'text' as const, text }] };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: `Error getting lead: ${e.response?.data?.message || e.message}` }] };
      }
    },
  );

  server.tool(
    'crm_move_lead',
    'Move a lead to a different status',
    {
      leadId: z.string().describe('Lead ID'),
      statusId: z.string().describe('Target status ID'),
    },
    async ({ leadId, statusId }) => {
      try {
        const { data: lead } = await apiClient.patch(`/leads/${leadId}/move`, { statusId });
        return {
          content: [{ type: 'text' as const, text: `Lead "${lead.title}" moved to status "${lead.status?.name || statusId}".` }],
        };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: `Error moving lead: ${e.response?.data?.message || e.message}` }] };
      }
    },
  );

  server.tool(
    'crm_assign_lead',
    'Assign a lead to a team member',
    {
      leadId: z.string().describe('Lead ID'),
      assigneeId: z.string().describe('Assignee user ID'),
    },
    async ({ leadId, assigneeId }) => {
      try {
        const { data: lead } = await apiClient.patch(`/leads/${leadId}/assign`, { assigneeId });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Lead "${lead.title}" assigned to ${lead.assignee?.name || assigneeId}.`,
            },
          ],
        };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: `Error assigning lead: ${e.response?.data?.message || e.message}` }] };
      }
    },
  );

  server.tool(
    'crm_delete_lead',
    'Delete a lead',
    {
      leadId: z.string().describe('Lead ID'),
    },
    async ({ leadId }) => {
      try {
        await apiClient.delete(`/leads/${leadId}`);
        return { content: [{ type: 'text' as const, text: `Lead ${leadId} deleted successfully.` }] };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: `Error deleting lead: ${e.response?.data?.message || e.message}` }] };
      }
    },
  );

  server.tool(
    'crm_add_note',
    'Add a note to a lead',
    {
      leadId: z.string().describe('Lead ID'),
      content: z.string().describe('Note content'),
    },
    async ({ leadId, content }) => {
      try {
        const { data: note } = await apiClient.post(`/leads/${leadId}/notes`, { content });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Note added to lead ${leadId}:\n"${note.content || content}"`,
            },
          ],
        };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: `Error adding note: ${e.response?.data?.message || e.message}` }] };
      }
    },
  );
}
