import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiClient } from '../api-client.js';

export function registerDashboardTools(server: McpServer) {
  server.tool(
    'crm_dashboard',
    'Get CRM dashboard metrics (totals, conversion, revenue)',
    {
      pipelineId: z.string().optional().describe('Filter by pipeline ID'),
      period: z.string().optional().describe('Time period (e.g. "7d", "30d", "90d", "month", "quarter")'),
    },
    async (params) => {
      try {
        const { data } = await apiClient.get('/dashboard', { params });
        const lines: string[] = ['--- CRM Dashboard ---'];

        if (data.totalLeads != null) lines.push(`Total Leads: ${data.totalLeads}`);
        if (data.newLeads != null) lines.push(`New Leads: ${data.newLeads}`);
        if (data.wonLeads != null) lines.push(`Won: ${data.wonLeads}`);
        if (data.lostLeads != null) lines.push(`Lost: ${data.lostLeads}`);
        if (data.conversionRate != null) lines.push(`Conversion Rate: ${data.conversionRate}%`);
        if (data.totalRevenue != null) lines.push(`Total Revenue: R$ ${Number(data.totalRevenue).toLocaleString()}`);
        if (data.avgDealSize != null) lines.push(`Avg Deal Size: R$ ${Number(data.avgDealSize).toLocaleString()}`);
        if (data.avgCycleTime != null) lines.push(`Avg Cycle Time: ${data.avgCycleTime} days`);

        if (data.byPipeline && Array.isArray(data.byPipeline)) {
          lines.push('\nBy Pipeline:');
          data.byPipeline.forEach((p: any) => {
            lines.push(`  ${p.name}: ${p.totalLeads} leads, R$ ${Number(p.revenue || 0).toLocaleString()}`);
          });
        }

        if (data.byAssignee && Array.isArray(data.byAssignee)) {
          lines.push('\nBy Assignee:');
          data.byAssignee.forEach((a: any) => {
            lines.push(`  ${a.name}: ${a.totalLeads} leads, ${a.wonLeads || 0} won`);
          });
        }

        if (lines.length === 1) {
          lines.push(JSON.stringify(data, null, 2));
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: `Error fetching dashboard: ${e.response?.data?.message || e.message}` }] };
      }
    },
  );

  server.tool(
    'crm_funnel',
    'Get funnel visualization for a pipeline (leads per stage)',
    {
      pipelineId: z.string().describe('Pipeline ID'),
    },
    async ({ pipelineId }) => {
      try {
        const { data } = await apiClient.get(`/pipelines/${pipelineId}/funnel`);
        const stages = Array.isArray(data) ? data : data.stages || data.data || [];
        if (stages.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No funnel data available.' }] };
        }

        const maxCount = Math.max(...stages.map((s: any) => s.count || s.leadsCount || 0), 1);
        const barWidth = 30;

        const lines = ['--- Funnel ---'];
        stages.forEach((s: any) => {
          const count = s.count || s.leadsCount || 0;
          const bar = '█'.repeat(Math.round((count / maxCount) * barWidth));
          const value = s.totalValue || s.value;
          lines.push(`${s.name}: ${bar} ${count} leads${value != null ? ` (R$ ${Number(value).toLocaleString()})` : ''}`);
        });

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: `Error fetching funnel: ${e.response?.data?.message || e.message}` }] };
      }
    },
  );
}
