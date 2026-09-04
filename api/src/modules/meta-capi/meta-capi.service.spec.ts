import { MetaCapiService } from './meta-capi.service';

/**
 * Trava o contrato da carga que a Meta exige para eventos de CRM.
 * Errar action_source ou event_source não dá erro de HTTP — o evento entra
 * e simplesmente não é usado. Por isso está coberto aqui.
 */
describe('MetaCapiService', () => {
  const config = {
    get: (key: string) =>
      ({
        META_CAPI_ENABLED: true,
        META_CAPI_DATASET_ID: '1046663431035766',
        META_CAPI_ACCESS_TOKEN: 'token-de-teste',
        META_CAPI_API_VERSION: 'v26.0',
        META_CAPI_LEAD_EVENT_SOURCE: 'CRM SWIFT',
      })[key],
  } as any;

  const service = new MetaCapiService({} as any, config);
  const call = (name: string, ...args: any[]) => (service as any)[name](...args);

  // ─── Hash e normalização ─────────────────────────────────

  describe('hash', () => {
    it('normaliza antes de hashear (trim + lowercase)', () => {
      expect(call('hash', '  Test@Test.com ')).toBe(call('hash', 'test@test.com'));
    });

    it('bate com o vetor de exemplo da documentação da Meta', () => {
      // Telefone 16505551234 do exemplo oficial de carga de CRM.
      expect(call('hash', '16505551234')).toBe(
        '6069d14bf122fdfd931dc7beb58e5dfbba395b1faf05bdcd42d12358d63d8599',
      );
    });

    it('devolve undefined quando não há valor', () => {
      expect(call('hash', null)).toBeUndefined();
      expect(call('hash', '   ')).toBeUndefined();
    });
  });

  describe('normalizePhone', () => {
    it('adiciona o 55 em celular brasileiro com DDD', () => {
      expect(call('normalizePhone', '(11) 99999-8888')).toBe('5511999998888');
    });

    it('adiciona o 55 em fixo brasileiro com DDD', () => {
      expect(call('normalizePhone', '11 3333-4444')).toBe('551133334444');
    });

    it('não duplica o código do país quando já veio', () => {
      expect(call('normalizePhone', '+55 11 99999-8888')).toBe('5511999998888');
    });

    it('ignora entrada sem dígitos', () => {
      expect(call('normalizePhone', 'sem numero')).toBeUndefined();
    });
  });

  describe('buildFbc', () => {
    it('prefere o cookie _fbc quando o formulário mandou', () => {
      expect(
        call('buildFbc', { fbc: 'fb.1.123.abc', fbclid: 'xyz' }),
      ).toBe('fb.1.123.abc');
    });

    it('reconstrói a partir do fbclid + hora do clique', () => {
      const clickedAt = new Date(1_700_000_000_000);
      expect(call('buildFbc', { fbclid: 'abc123', clickedAt })).toBe(
        'fb.1.1700000000000.abc123',
      );
    });

    it('sem fbclid e sem fbc não inventa click id', () => {
      expect(call('buildFbc', {})).toBeUndefined();
    });
  });

  // ─── Mapa de estágio → evento ────────────────────────────

  describe('resolveEventName', () => {
    const status = (over: Partial<Record<string, boolean>> = {}) => ({
      isWon: false,
      isFinal: false,
      isMeeting: false,
      isMql: false,
      ...over,
    });

    it('ganho vira Purchase', () => {
      expect(service.resolveEventName(status({ isWon: true, isFinal: true }))).toBe(
        'Purchase',
      );
    });

    it('reunião vira Schedule', () => {
      expect(service.resolveEventName(status({ isMeeting: true }))).toBe('Schedule');
    });

    it('MQL vira Lead', () => {
      expect(service.resolveEventName(status({ isMql: true }))).toBe('Lead');
    });

    it('ganho tem precedência sobre as outras flags', () => {
      expect(
        service.resolveEventName(status({ isWon: true, isMeeting: true, isMql: true })),
      ).toBe('Purchase');
    });

    it('coluna sem flag não vira evento', () => {
      expect(service.resolveEventName(status())).toBeNull();
    });
  });

  // ─── Contrato da carga ───────────────────────────────────

  describe('buildPayload', () => {
    const lead = {
      id: 'lead_1',
      estimatedValue: 250_00, // centavos
      contact: {
        id: 'contact_1',
        name: 'Maria Silva Souza',
        email: 'MARIA@Exemplo.com.br',
        phone: '(11) 99999-8888',
      },
      tracking: {
        metaLeadId: '123456789012345',
        fbclid: 'abc123',
        fbp: 'fb.1.1700000000000.987654321',
        clickedAt: new Date(1_700_000_000_000),
        ip: '200.1.2.3',
        userAgent: 'Mozilla/5.0',
      },
    };

    const payload = (over: any = {}) =>
      call(
        'buildPayload',
        { ...lead, ...over },
        over.eventName ?? 'Lead',
        new Date(1_700_000_500_000),
        'evt-1',
      );

    it('usa os três campos obrigatórios de CRM', () => {
      const p = payload();
      expect(p.action_source).toBe('system_generated');
      expect(p.custom_data.event_source).toBe('crm');
      expect(p.custom_data.lead_event_source).toBe('CRM SWIFT');
    });

    it('manda event_time em segundos unix, não milissegundos', () => {
      expect(payload().event_time).toBe(1_700_000_500);
    });

    it('manda o lead_id da Meta como número e sem hash', () => {
      expect(payload().user_data.lead_id).toBe(123456789012345);
    });

    it('rejeita lead_id fora do formato de 15 a 17 dígitos', () => {
      const p = payload({ tracking: { ...lead.tracking, metaLeadId: '123' } });
      expect(p.user_data.lead_id).toBeUndefined();
    });

    it('hasheia email e telefone, e os envia como array', () => {
      const p = payload();
      expect(p.user_data.em).toEqual([call('hash', 'maria@exemplo.com.br')]);
      expect(p.user_data.ph).toEqual([call('hash', '5511999998888')]);
    });

    it('não hasheia fbc e fbp', () => {
      const p = payload();
      expect(p.user_data.fbc).toBe('fb.1.1700000000000.abc123');
      expect(p.user_data.fbp).toBe('fb.1.1700000000000.987654321');
    });

    it('separa primeiro e último nome', () => {
      const p = payload();
      expect(p.user_data.fn).toEqual([call('hash', 'Maria')]);
      expect(p.user_data.ln).toEqual([call('hash', 'Souza')]);
    });

    it('converte centavos em reais no Purchase', () => {
      const p = payload({ eventName: 'Purchase' });
      expect(p.custom_data.value).toBe(250);
      expect(p.custom_data.currency).toBe('BRL');
    });

    it('não manda valor em evento que não é de venda', () => {
      expect(payload().custom_data.value).toBeUndefined();
    });

    it('omite as chaves que o lead não tem, em vez de mandar vazio', () => {
      const p = payload({ contact: { id: 'c2', name: 'Ana' }, tracking: {} });
      expect(p.user_data.em).toBeUndefined();
      expect(p.user_data.ph).toBeUndefined();
      expect(p.user_data.fbc).toBeUndefined();
      expect(p.user_data.lead_id).toBeUndefined();
      expect(p.user_data.fn).toEqual([call('hash', 'Ana')]);
    });
  });

  describe('matchKeysOf', () => {
    it('não conta ip e user agent como chave de correspondência', () => {
      const keys = call('matchKeysOf', {
        em: ['x'],
        client_ip_address: '1.2.3.4',
        client_user_agent: 'ua',
      });
      expect(keys).toEqual(['em']);
    });

    it('não conta external_id, que é um id do nosso banco que a Meta nunca viu', () => {
      expect(call('matchKeysOf', { external_id: ['x'] })).toEqual([]);
    });

    it('não conta nome sozinho — não identifica ninguém', () => {
      expect(call('matchKeysOf', { fn: ['x'], ln: ['y'] })).toEqual([]);
    });

    it('reconhece as chaves que a Meta realmente usa', () => {
      const keys = call('matchKeysOf', {
        lead_id: 1,
        fbc: 'fb.1.1.a',
        fbp: 'fb.1.1.b',
        em: ['x'],
        ph: ['y'],
        external_id: ['z'],
      });
      expect(keys).toEqual(['lead_id', 'fbc', 'fbp', 'em', 'ph']);
    });
  });
});
