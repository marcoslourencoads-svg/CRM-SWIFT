import { ReportBuilderService } from './report-builder.service';
import { MetaCampaignInsight } from './meta-graph.service';

const builder = new ReportBuilderService();

function fixture(overrides: Partial<MetaCampaignInsight>): MetaCampaignInsight {
  return {
    campaign_id: '1',
    campaign_name: '[AQ] Teste',
    spend: '0',
    reach: '0',
    impressions: '0',
    inline_link_clicks: '0',
    actions: [],
    action_values: [],
    ...overrides,
  };
}

describe('ReportBuilderService', () => {
  it('agrupa campanhas por prefixo', () => {
    const insights: MetaCampaignInsight[] = [
      fixture({ campaign_name: '[AQ] Reels Hambúrguer', spend: '50.00', reach: '10000', impressions: '15000' }),
      fixture({ campaign_name: '[VD] WhatsApp Combo', spend: '120.00', inline_link_clicks: '80' }),
      fixture({ campaign_name: '[RM] Visitantes 30d', spend: '25.50' }),
      fixture({ campaign_name: '[ENG] Curtidas', spend: '10.00' }),
      fixture({ campaign_name: 'Sem prefixo aqui', spend: '5.00' }),
    ];

    const result = builder.build('Burger do Zé', 'Ontem', insights);

    expect(result.bucketsSummary.AQ.spend).toBe(50);
    expect(result.bucketsSummary.VD.spend).toBe(120);
    expect(result.bucketsSummary.RM.spend).toBe(25.5);
    expect(result.bucketsSummary.ENG.spend).toBe(10);
    expect(result.bucketsSummary.OUTROS.spend).toBe(5);
    expect(result.bucketsSummary.OUTROS.campaigns).toEqual(['Sem prefixo aqui']);
    expect(result.totalSpendCents).toBe(21050);
  });

  it('é case-insensitive no prefixo', () => {
    const insights = [fixture({ campaign_name: '[aq] minúsculo', spend: '10' })];
    const result = builder.build('X', 'Hoje', insights);
    expect(result.bucketsSummary.AQ.spend).toBe(10);
    expect(result.bucketsSummary.OUTROS.campaigns).toHaveLength(0);
  });

  it('soma mensagens iniciadas e calcula custo/mensagem em VENDAS', () => {
    const insights = [
      fixture({
        campaign_name: '[VD] WhatsApp',
        spend: '100',
        actions: [
          {
            action_type: 'onsite_conversion.messaging_conversation_started_7d',
            value: '20',
          },
        ],
      }),
    ];
    const result = builder.build('Cliente', 'Ontem', insights);
    expect(result.bucketsSummary.VD.messagingStarted).toBe(20);
    expect(result.text).toContain('Mensagens iniciadas: 20');
    expect(result.text).toContain('Custo/mensagem: R$');
  });

  it('calcula ROAS quando há compras', () => {
    const insights = [
      fixture({
        campaign_name: '[VD] Cupom',
        spend: '100',
        actions: [{ action_type: 'purchase', value: '5' }],
        action_values: [{ action_type: 'purchase', value: '500' }],
      }),
    ];
    const result = builder.build('X', 'Hoje', insights);
    expect(result.bucketsSummary.VD.purchases).toBe(5);
    expect(result.bucketsSummary.VD.purchaseValue).toBe(500);
    expect(result.text).toMatch(/ROAS: 5\.00x/);
  });

  it('lida com campanhas zeradas sem quebrar', () => {
    const insights = [fixture({ campaign_name: '[AQ] Vazia' })];
    const result = builder.build('X', 'Ontem', insights);
    expect(result.totalSpendCents).toBe(0);
    expect(result.text).toMatch(/Total investido: R\$\s0,00/);
  });

  it('calcula CPM e frequência em campanhas de aquecimento', () => {
    const insights = [
      fixture({
        campaign_name: '[AQ] Reels',
        spend: '50',
        reach: '10000',
        impressions: '20000',
      }),
    ];
    const result = builder.build('X', 'Ontem', insights);
    expect(result.text).toContain('Alcance: 10.000');
    expect(result.text).toContain('freq 2.00');
    expect(result.text).toMatch(/CPM: R\$\s2,50/);
  });

  it('lista campanhas sem prefixo no aviso', () => {
    const insights = [
      fixture({ campaign_name: 'A', spend: '5' }),
      fixture({ campaign_name: 'B', spend: '5' }),
    ];
    const result = builder.build('X', 'Ontem', insights);
    expect(result.unprefixedCampaigns).toEqual(['A', 'B']);
    expect(result.text).toContain('2 campanha(s) sem prefixo');
  });
});
