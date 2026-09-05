import { ProspectingAnalyticsService } from './prospecting-analytics.service';

/**
 * Trava a matemática do funil de prospecção.
 *
 * O motivo de existir: a planilha que este módulo substitui contava
 * quem estava PARADO em cada etapa e dividia tudo pelo total, o que
 * mistura coortes e some com quem já avançou. O dashboard de leads tem
 * o mesmo vício. Aqui o funil é por coorte de abordagem e cada degrau
 * conta quem ALGUM DIA chegou lá — se isso regredir, os números voltam
 * a mentir sem que nada quebre.
 */
describe('ProspectingAnalyticsService', () => {
  const service = new ProspectingAnalyticsService({} as never);
  const call = (name: string, ...args: unknown[]) =>
    (service as unknown as Record<string, (...a: unknown[]) => unknown>)[name](...args);

  const d = (iso: string) => new Date(iso);

  // Um prospect mínimo com os carimbos que o funil lê.
  const p = (over: Record<string, unknown> = {}) => ({
    id: Math.random().toString(36).slice(2),
    firstContactedAt: d('2026-08-01T12:00:00Z'),
    respondedAt: null,
    meetingSetAt: null,
    meetingHeldAt: null,
    wonAt: null,
    lostAt: null,
    lostReasonId: null,
    dealValue: 0,
    touchCount: 1,
    channel: 'INSTAGRAM',
    hasAds: null,
    niche: null,
    owner: null,
    list: null,
    touches: [],
    ...over,
  });

  // ─── Degraus do funil ────────────────────────────────────

  describe('buildSteps', () => {
    it('conta quem ALGUM DIA atingiu o carimbo, não quem está parado ali', () => {
      // Quem fechou contrato já passou por resposta e reunião. Num funil
      // "foto" ele apareceria só em Fechamentos e sumiria dos degraus
      // anteriores, fazendo a taxa de resposta parecer menor do que é.
      const cohort = [
        p({
          respondedAt: d('2026-08-02T12:00:00Z'),
          meetingSetAt: d('2026-08-03T12:00:00Z'),
          meetingHeldAt: d('2026-08-04T12:00:00Z'),
          wonAt: d('2026-08-05T12:00:00Z'),
        }),
        p({ respondedAt: d('2026-08-02T12:00:00Z') }),
        p(),
        p(),
      ];

      const steps = call('buildSteps', cohort) as { label: string; count: number }[];

      expect(steps.map((s) => [s.label, s.count])).toEqual([
        ['Abordados', 4],
        ['Responderam', 2],
        ['Reuniões agendadas', 1],
        ['Reuniões realizadas', 1],
        ['Fechamentos', 1],
      ]);
    });

    it('devolve as DUAS porcentagens: da etapa anterior e do topo', () => {
      const cohort = [
        ...Array.from({ length: 6 }, () => p()),
        ...Array.from({ length: 4 }, () =>
          p({ respondedAt: d('2026-08-02T12:00:00Z') }),
        ),
      ];
      // 10 abordados, 4 responderam, 1 agendou.
      cohort[9] = p({
        respondedAt: d('2026-08-02T12:00:00Z'),
        meetingSetAt: d('2026-08-03T12:00:00Z'),
      });

      const steps = call('buildSteps', cohort) as {
        pctFromPrev: number;
        pctFromTop: number;
      }[];

      expect(steps[1]).toMatchObject({ pctFromPrev: 40, pctFromTop: 40 });
      // 1 de 4 que responderam = 25% do degrau anterior, mas 10% do topo.
      expect(steps[2]).toMatchObject({ pctFromPrev: 25, pctFromTop: 10 });
    });

    it('não divide por zero quando ninguém respondeu', () => {
      const steps = call('buildSteps', [p(), p()]) as {
        pctFromPrev: number;
        pctFromTop: number;
      }[];
      expect(steps[2]).toMatchObject({ count: 0, pctFromPrev: 0, pctFromTop: 0 });
    });

    it('reproduz a taxa da planilha antiga: 1 resposta em 19 abordagens', () => {
      const cohort = [
        p({ respondedAt: d('2026-08-02T12:00:00Z') }),
        ...Array.from({ length: 18 }, () => p()),
      ];
      const steps = call('buildSteps', cohort) as { pctFromTop: number }[];
      expect(steps[1].pctFromTop).toBe(5.26);
    });
  });

  // ─── Métricas de dinheiro e tempo ────────────────────────

  describe('buildMetrics', () => {
    it('calcula total em contratos e ticket médio (as duas células #REF! da planilha)', () => {
      const cohort = [
        p({ wonAt: d('2026-08-10T12:00:00Z'), dealValue: 3000 }),
        p({ wonAt: d('2026-08-10T12:00:00Z'), dealValue: 2000 }),
        p({ dealValue: 9999 }), // não fechou: não entra na receita
      ];

      const m = call('buildMetrics', cohort) as Record<string, number>;
      expect(m.totalContratos).toBe(5000);
      expect(m.ticketMedio).toBe(2500);
      expect(m.fechamentos).toBe(2);
    });

    it('ticket médio é zero sem fechamento, em vez de NaN', () => {
      const m = call('buildMetrics', [p(), p()]) as Record<string, number>;
      expect(m.ticketMedio).toBe(0);
      expect(m.totalContratos).toBe(0);
    });

    it('mede o no-show: a planilha tinha os dois campos e nunca subtraía', () => {
      const cohort = [
        p({
          respondedAt: d('2026-08-02T12:00:00Z'),
          meetingSetAt: d('2026-08-03T12:00:00Z'),
          meetingHeldAt: d('2026-08-04T12:00:00Z'),
        }),
        p({
          respondedAt: d('2026-08-02T12:00:00Z'),
          meetingSetAt: d('2026-08-03T12:00:00Z'),
        }),
        p({
          respondedAt: d('2026-08-02T12:00:00Z'),
          meetingSetAt: d('2026-08-03T12:00:00Z'),
        }),
        p({
          respondedAt: d('2026-08-02T12:00:00Z'),
          meetingSetAt: d('2026-08-03T12:00:00Z'),
        }),
      ];
      // 4 agendadas, 1 realizada -> 75% de no-show.
      expect((call('buildMetrics', cohort) as Record<string, number>).noShowRate).toBe(75);
    });

    it('calcula ciclo de venda em dias e tempo até resposta em horas', () => {
      const cohort = [
        p({
          firstContactedAt: d('2026-08-01T00:00:00Z'),
          respondedAt: d('2026-08-01T06:00:00Z'),
          wonAt: d('2026-08-11T00:00:00Z'),
        }),
      ];
      const m = call('buildMetrics', cohort) as Record<string, number>;
      expect(m.cicloMedioDias).toBe(10);
      expect(m.tempoMedioAteRespostaHoras).toBe(6);
    });

    it('registra em qual toque a resposta chegou', () => {
      const cohort = [
        p({
          respondedAt: d('2026-08-05T12:00:00Z'),
          touches: [
            { sequence: 1, outcome: 'NO_REPLY' },
            { sequence: 2, outcome: 'NO_REPLY' },
            { sequence: 3, outcome: 'REPLIED_POSITIVE' },
          ],
        }),
        p({
          respondedAt: d('2026-08-05T12:00:00Z'),
          touches: [{ sequence: 1, outcome: 'REPLIED_POSITIVE' }],
        }),
      ];
      expect(
        (call('buildMetrics', cohort) as Record<string, number>).toquesMedioAteResposta,
      ).toBe(2);
    });
  });

  // ─── Resposta por número de toque ────────────────────────

  describe('buildByTouchNumber', () => {
    it('mostra a resposta no toque em que ela realmente aconteceu', () => {
      // A pergunta que a planilha não respondia: o 3º follow-up paga o
      // esforço? Aqui a resposta plantada no toque 3 tem que aparecer
      // no toque 3, e não diluída no total.
      const cohort = [
        p({
          touches: [
            { sequence: 1, outcome: 'NO_REPLY' },
            { sequence: 2, outcome: 'NO_REPLY' },
            { sequence: 3, outcome: 'REPLIED_POSITIVE' },
          ],
        }),
        p({
          touches: [
            { sequence: 1, outcome: 'NO_REPLY' },
            { sequence: 2, outcome: 'NO_REPLY' },
          ],
        }),
      ];

      const rows = call('buildByTouchNumber', cohort) as {
        sequence: number;
        label: string;
        enviados: number;
        respostas: number;
        taxaResposta: number;
      }[];

      expect(rows).toEqual([
        expect.objectContaining({
          sequence: 1,
          label: 'Abordagem',
          enviados: 2,
          respostas: 0,
          taxaResposta: 0,
        }),
        expect.objectContaining({
          sequence: 2,
          label: 'FUP 1',
          enviados: 2,
          respostas: 0,
        }),
        expect.objectContaining({
          sequence: 3,
          label: 'FUP 2',
          enviados: 1,
          respostas: 1,
          taxaResposta: 100,
        }),
      ]);
    });

    it('conta resposta negativa como resposta', () => {
      // Recusar é responder. Separar as duas coisas é o que permite ver
      // que um script gera muita resposta e nenhuma reunião.
      const cohort = [
        p({ touches: [{ sequence: 1, outcome: 'REPLIED_NEGATIVE' }] }),
      ];
      const rows = call('buildByTouchNumber', cohort) as { respostas: number }[];
      expect(rows[0].respostas).toBe(1);
    });

    it('não conta NO_ANSWER de ligação como resposta', () => {
      const cohort = [p({ touches: [{ sequence: 1, outcome: 'NO_ANSWER' }] })];
      const rows = call('buildByTouchNumber', cohort) as { respostas: number }[];
      expect(rows[0].respostas).toBe(0);
    });
  });

  // ─── Cortes ──────────────────────────────────────────────

  describe('cutBy', () => {
    const keyOf = (x: { hasAds: boolean | null }) => ({
      chave: String(x.hasAds),
      label: x.hasAds ? 'Anuncia' : 'Não anuncia',
    });

    it('cruza conversão por "tem anúncio" — o campo que a planilha coletava e nunca usava', () => {
      const cohort = [
        p({ hasAds: true, respondedAt: d('2026-08-02T12:00:00Z') }),
        p({ hasAds: true, respondedAt: d('2026-08-02T12:00:00Z') }),
        p({ hasAds: false }),
        p({ hasAds: false }),
      ];

      const rows = call('cutBy', cohort, keyOf) as {
        chave: string;
        taxaResposta: number;
        abordados: number;
      }[];

      expect(rows.find((r) => r.chave === 'true')).toMatchObject({
        abordados: 2,
        taxaResposta: 100,
      });
      expect(rows.find((r) => r.chave === 'false')).toMatchObject({
        abordados: 2,
        taxaResposta: 0,
      });
    });

    it('marca amostra insuficiente abaixo de 30 abordados', () => {
      // Guarda contra repetir o erro de decidir com 19 registros.
      const pequeno = call('cutBy', [p({ hasAds: true })], keyOf) as {
        amostraSuficiente: boolean;
      }[];
      expect(pequeno[0].amostraSuficiente).toBe(false);

      const grande = call(
        'cutBy',
        Array.from({ length: 30 }, () => p({ hasAds: true })),
        keyOf,
      ) as { amostraSuficiente: boolean }[];
      expect(grande[0].amostraSuficiente).toBe(true);
    });

    it('só soma receita de quem fechou', () => {
      const cohort = [
        p({ hasAds: true, wonAt: d('2026-08-10T12:00:00Z'), dealValue: 1000 }),
        p({ hasAds: true, dealValue: 5000 }),
      ];
      const rows = call('cutBy', cohort, keyOf) as { receita: number }[];
      expect(rows[0].receita).toBe(1000);
    });
  });

  describe('buildLostReasons', () => {
    it('agrega por motivo do catálogo em vez de texto livre', () => {
      const names = new Map([['r1', 'Preço alto']]);
      const cohort = [
        p({ lostAt: d('2026-08-09T12:00:00Z'), lostReasonId: 'r1' }),
        p({ lostAt: d('2026-08-09T12:00:00Z'), lostReasonId: 'r1' }),
        p({ lostAt: d('2026-08-09T12:00:00Z'), lostReasonId: null }),
        p(),
      ];

      const rows = call('buildLostReasons', cohort, names) as {
        nome: string;
        count: number;
        pct: number;
      }[];

      expect(rows[0]).toMatchObject({ nome: 'Preço alto', count: 2, pct: 66.67 });
      expect(rows[1]).toMatchObject({ nome: 'Sem motivo registrado', count: 1 });
    });
  });
});
