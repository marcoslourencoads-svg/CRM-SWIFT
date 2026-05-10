import { Injectable } from '@nestjs/common';
import {
  MetaCampaignInsight,
  MetaInsightAction,
} from './meta-graph.service';

export type CampaignBucket = 'AQ' | 'VD' | 'RM' | 'ENG' | 'OUTROS';

const PREFIX_REGEX = /^\[(AQ|VD|RM|ENG)\]/i;

const BUCKET_LABELS: Record<CampaignBucket, string> = {
  AQ: 'AQUECIMENTO',
  VD: 'VENDAS',
  RM: 'REMARKETING',
  ENG: 'ENGAJAMENTO',
  OUTROS: 'SEM PREFIXO',
};

const BUCKET_EMOJI: Record<CampaignBucket, string> = {
  AQ: '🔥',
  VD: '💰',
  RM: '🎯',
  ENG: '👥',
  OUTROS: '❔',
};

interface BucketTotals {
  spend: number;
  reach: number;
  impressions: number;
  linkClicks: number;
  videoViews: number;
  pageEngagement: number;
  profileVisits: number;
  messagingStarted: number;
  purchases: number;
  purchaseValue: number;
  campaigns: string[];
}

export interface BuiltReport {
  text: string;
  totalSpendCents: number;
  bucketsSummary: Record<CampaignBucket, BucketTotals>;
  unprefixedCampaigns: string[];
}

@Injectable()
export class ReportBuilderService {
  build(
    clientName: string,
    periodLabel: string,
    insights: MetaCampaignInsight[],
  ): BuiltReport {
    const buckets = emptyBuckets();

    for (const c of insights) {
      const bucket = classify(c.campaign_name);
      const t = buckets[bucket];
      t.spend += num(c.spend);
      t.reach += int(c.reach);
      t.impressions += int(c.impressions);
      t.linkClicks += int(c.inline_link_clicks);
      t.videoViews += sumActions(c.video_thruplay_watched_actions);
      t.pageEngagement += actionByType(c.actions, 'page_engagement');
      t.profileVisits +=
        actionByType(c.actions, 'onsite_conversion.view_content') +
        actionByType(c.actions, 'landing_page_view');
      t.messagingStarted += actionByType(
        c.actions,
        'onsite_conversion.messaging_conversation_started_7d',
      );
      t.purchases += actionByType(c.actions, 'purchase');
      t.purchaseValue += valueByType(c.action_values, 'purchase');
      t.campaigns.push(c.campaign_name);
    }

    const totalSpend =
      buckets.AQ.spend +
      buckets.VD.spend +
      buckets.RM.spend +
      buckets.ENG.spend +
      buckets.OUTROS.spend;

    const text = renderText(clientName, periodLabel, buckets, totalSpend);

    return {
      text,
      totalSpendCents: Math.round(totalSpend * 100),
      bucketsSummary: buckets,
      unprefixedCampaigns: buckets.OUTROS.campaigns,
    };
  }
}

function classify(name: string): CampaignBucket {
  const m = name.match(PREFIX_REGEX);
  if (!m) return 'OUTROS';
  return m[1].toUpperCase() as CampaignBucket;
}

function emptyBuckets(): Record<CampaignBucket, BucketTotals> {
  const make = (): BucketTotals => ({
    spend: 0,
    reach: 0,
    impressions: 0,
    linkClicks: 0,
    videoViews: 0,
    pageEngagement: 0,
    profileVisits: 0,
    messagingStarted: 0,
    purchases: 0,
    purchaseValue: 0,
    campaigns: [],
  });
  return { AQ: make(), VD: make(), RM: make(), ENG: make(), OUTROS: make() };
}

function num(v?: string): number {
  return v ? Number(v) || 0 : 0;
}

function int(v?: string): number {
  return v ? parseInt(v, 10) || 0 : 0;
}

function actionByType(actions: MetaInsightAction[] | undefined, type: string): number {
  if (!actions) return 0;
  const a = actions.find((x) => x.action_type === type);
  return a ? num(a.value) : 0;
}

function valueByType(actions: MetaInsightAction[] | undefined, type: string): number {
  return actionByType(actions, type);
}

function sumActions(actions: MetaInsightAction[] | undefined): number {
  if (!actions) return 0;
  return actions.reduce((s, a) => s + num(a.value), 0);
}

function brl(v: number): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

function n(v: number): string {
  return Math.round(v).toLocaleString('pt-BR');
}

function renderBucket(
  bucket: CampaignBucket,
  t: BucketTotals,
): string | null {
  if (t.spend === 0 && t.impressions === 0 && t.campaigns.length === 0) {
    return null;
  }
  const lines: string[] = [`${BUCKET_EMOJI[bucket]} ${BUCKET_LABELS[bucket]}`];
  lines.push(`Investido: ${brl(t.spend)}`);

  if (bucket === 'VD') {
    lines.push(`Cliques no link: ${n(t.linkClicks)}`);
    if (t.messagingStarted > 0) {
      const cpm = t.messagingStarted ? t.spend / t.messagingStarted : 0;
      lines.push(`Mensagens iniciadas: ${n(t.messagingStarted)}`);
      lines.push(`Custo/mensagem: ${brl(cpm)}`);
    }
    if (t.purchases > 0) {
      const roas = t.spend ? t.purchaseValue / t.spend : 0;
      const cpa = t.spend / t.purchases;
      lines.push(`Compras: ${n(t.purchases)} (${brl(t.purchaseValue)})`);
      lines.push(`CPA: ${brl(cpa)} | ROAS: ${roas.toFixed(2)}x`);
    }
  } else {
    lines.push(`Alcance: ${n(t.reach)}`);
    const freq = t.reach ? t.impressions / t.reach : 0;
    lines.push(
      `Impressões: ${n(t.impressions)} (freq ${freq.toFixed(2)})`,
    );
    const cpm = t.impressions ? (t.spend / t.impressions) * 1000 : 0;
    lines.push(`CPM: ${brl(cpm)}`);
    if (t.videoViews > 0) {
      lines.push(`Visualizações de vídeo: ${n(t.videoViews)}`);
    }
    if (t.pageEngagement > 0) {
      lines.push(`Engajamentos: ${n(t.pageEngagement)}`);
    }
    if (t.profileVisits > 0) {
      lines.push(`Visitas/Views: ${n(t.profileVisits)}`);
    }
  }

  return lines.join('\n');
}

function renderText(
  clientName: string,
  periodLabel: string,
  buckets: Record<CampaignBucket, BucketTotals>,
  totalSpend: number,
): string {
  const sections: string[] = [
    `📊 ${clientName} — ${periodLabel}`,
    '',
  ];

  const order: CampaignBucket[] = ['AQ', 'ENG', 'RM', 'VD', 'OUTROS'];
  for (const b of order) {
    if (b === 'OUTROS') continue;
    const block = renderBucket(b, buckets[b]);
    if (block) {
      sections.push(block, '');
    }
  }

  const outros = buckets.OUTROS;
  if (outros.campaigns.length > 0) {
    const list = outros.campaigns
      .slice(0, 5)
      .map((c) => `"${c}"`)
      .join(', ');
    const more =
      outros.campaigns.length > 5
        ? ` (+${outros.campaigns.length - 5})`
        : '';
    sections.push(
      `⚠️ ${outros.campaigns.length} campanha(s) sem prefixo: ${list}${more}`,
      `Investido sem classificar: ${brl(outros.spend)}`,
      '',
    );
  }

  sections.push(`💵 Total investido: ${brl(totalSpend)}`);

  return sections.join('\n').trim();
}
