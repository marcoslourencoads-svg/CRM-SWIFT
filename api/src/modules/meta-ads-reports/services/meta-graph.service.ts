import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

const INSIGHT_FIELDS = [
  'campaign_id',
  'campaign_name',
  'objective',
  'spend',
  'reach',
  'impressions',
  'cpm',
  'frequency',
  'ctr',
  'inline_link_clicks',
  'actions',
  'action_values',
  'video_thruplay_watched_actions',
  'cost_per_action_type',
].join(',');

export interface MetaInsightAction {
  action_type: string;
  value: string;
}

export interface MetaCampaignInsight {
  campaign_id: string;
  campaign_name: string;
  objective?: string;
  spend?: string;
  reach?: string;
  impressions?: string;
  cpm?: string;
  frequency?: string;
  ctr?: string;
  inline_link_clicks?: string;
  actions?: MetaInsightAction[];
  action_values?: MetaInsightAction[];
  video_thruplay_watched_actions?: MetaInsightAction[];
  cost_per_action_type?: MetaInsightAction[];
}

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week_mon_today'
  | 'last_7d'
  | 'last_14d'
  | 'last_30d';

@Injectable()
export class MetaGraphService {
  private readonly logger = new Logger(MetaGraphService.name);

  async fetchCampaignInsights(
    adAccountId: string,
    accessToken: string,
    datePreset: DatePreset = 'yesterday',
  ): Promise<MetaCampaignInsight[]> {
    const accountPath = adAccountId.startsWith('act_')
      ? adAccountId
      : `act_${adAccountId}`;

    const url = `${GRAPH_BASE}/${accountPath}/insights`;

    try {
      const { data } = await axios.get<{ data: MetaCampaignInsight[] }>(url, {
        params: {
          access_token: accessToken,
          level: 'campaign',
          date_preset: datePreset,
          fields: INSIGHT_FIELDS,
          limit: 500,
        },
        timeout: 30_000,
      });
      return data.data ?? [];
    } catch (err) {
      const axiosErr = err as AxiosError<any>;
      const apiMsg =
        axiosErr.response?.data?.error?.message ?? axiosErr.message;
      this.logger.error(
        `Meta API failed for ${accountPath}: ${apiMsg}`,
      );
      throw new BadGatewayException(`Meta API: ${apiMsg}`);
    }
  }
}
