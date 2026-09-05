import { ProspectsService } from './prospects.service';

/**
 * Trava a máquina de etapas e a cadência.
 *
 * Na planilha a etapa não existia como campo: era inferida de 11
 * booleanos independentes, o que produzia linhas com "Fez FUP 3? Não"
 * e FUP 1 em branco, ou "Fechou Contrato" sem ter respondido. Aqui a
 * etapa é derivada no serviço e os carimbos são preenchidos para trás.
 * Se isso regredir, o funil por coorte volta a mentir.
 */
describe('ProspectsService', () => {
  const service = new ProspectsService({} as never, {} as never, {} as never);
  const call = (name: string, ...args: unknown[]) =>
    (service as unknown as Record<string, (...a: unknown[]) => unknown>)[name](...args);

  const when = new Date('2026-09-04T12:00:00Z');

  // ─── Carimbos monotônicos ────────────────────────────────

  describe('stampsFor', () => {
    it('preenche para trás todo carimbo vazio até a etapa alvo', () => {
      // Pular direto para "fez reunião" tem que implicar que respondeu
      // e que foi abordado — senão esses registros somem dos degraus
      // anteriores do funil.
      const stamps = call('stampsFor', {}, 'MEETING_DONE', when) as Record<string, Date>;

      expect(Object.keys(stamps).sort()).toEqual([
        'firstContactedAt',
        'meetingHeldAt',
        'meetingSetAt',
        'respondedAt',
      ]);
      expect(stamps.respondedAt).toBe(when);
    });

    it('não sobrescreve carimbo que já existe', () => {
      // A data real da resposta vale mais que a data de hoje: preservar
      // é o que mantém o tempo-até-resposta honesto.
      const antes = new Date('2026-08-01T00:00:00Z');
      const stamps = call(
        'stampsFor',
        { firstContactedAt: antes, respondedAt: antes },
        'WON',
        when,
      ) as Record<string, Date>;

      expect(stamps.firstContactedAt).toBeUndefined();
      expect(stamps.respondedAt).toBeUndefined();
      expect(stamps.wonAt).toBe(when);
    });

    it('não carimba nada além da etapa alvo', () => {
      const stamps = call('stampsFor', {}, 'CONTACTED', when) as Record<string, Date>;
      expect(Object.keys(stamps)).toEqual(['firstContactedAt']);
      expect(stamps.wonAt).toBeUndefined();
    });

    it('perda não carimba progresso — dá para perder em qualquer ponto', () => {
      expect(call('stampsFor', {}, 'LOST', when)).toEqual({});
      expect(call('stampsFor', {}, 'DISQUALIFIED', when)).toEqual({});
    });

    it('FOLLOW_UP não inventa carimbo próprio: é a mesma coorte de abordados', () => {
      const stamps = call('stampsFor', {}, 'FOLLOW_UP', when) as Record<string, Date>;
      expect(Object.keys(stamps)).toEqual(['firstContactedAt']);
    });
  });

  // ─── Ordem das etapas ────────────────────────────────────

  describe('maxStage', () => {
    it('nunca retrocede a etapa', () => {
      expect(call('maxStage', 'MEETING_SET', 'RESPONDED')).toBe('MEETING_SET');
      expect(call('maxStage', 'CONTACTED', 'RESPONDED')).toBe('RESPONDED');
    });

    it('ressuscita quem estava perdido quando volta a responder', () => {
      expect(call('maxStage', 'LOST', 'RESPONDED')).toBe('RESPONDED');
      expect(call('maxStage', 'DISQUALIFIED', 'RESPONDED')).toBe('RESPONDED');
    });
  });

  // ─── Identidade do perfil ────────────────────────────────

  describe('normalizeHandle', () => {
    it('reduz @, URL e caixa alta ao mesmo handle', () => {
      // Sem isto o mesmo perfil entra duas vezes na lista, uma pelo
      // link e outra pelo @ digitado.
      expect(call('normalizeHandle', '@SR.Pizza')).toBe('sr.pizza');
      expect(call('normalizeHandle', 'sr.pizza/')).toBe('sr.pizza');
      expect(call('normalizeHandle', undefined, 'https://www.instagram.com/sr.pizza/')).toBe(
        'sr.pizza',
      );
    });

    it('devolve null quando não há nada', () => {
      expect(call('normalizeHandle', '', '')).toBeNull();
      expect(call('normalizeHandle', undefined, undefined)).toBeNull();
    });
  });

  describe('profileUrlFromHandle', () => {
    it('monta a URL do Instagram para abrir o perfil direto da fila', () => {
      expect(call('profileUrlFromHandle', 'sr.pizza', 'INSTAGRAM')).toBe(
        'https://www.instagram.com/sr.pizza/',
      );
    });

    it('não inventa URL de Instagram para prospect de WhatsApp', () => {
      expect(call('profileUrlFromHandle', 'sr.pizza', 'WHATSAPP')).toBeNull();
    });
  });

  // ─── Ações em massa ──────────────────────────────────────

  describe('bulkStage', () => {
    function build(prospects: Record<string, unknown>[]) {
      const updates: Record<string, unknown>[] = [];
      const prisma = {
        prospect: {
          findMany: jest.fn().mockResolvedValue(prospects),
          update: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
            updates.push(args.data);
            return args;
          }),
        },
        $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.resolve(ops)),
      };
      const svc = new ProspectsService(prisma as never, {} as never, {} as never);
      return { svc, updates };
    }

    it('limpa os campos de perda ao ressuscitar um prospect', async () => {
      // O funil conta perda por lostAt. Um carimbo esquecido faria o
      // prospect continuar aparecendo nos motivos de perda depois de
      // voltar para a trilha ativa.
      const { svc, updates } = build([
        { id: 'p1', lostAt: new Date('2026-08-01T00:00:00Z'), lostReasonId: 'r1' },
      ]);

      await svc.bulkStage('org', { ids: ['p1'], stage: 'RESPONDED' });

      expect(updates[0]).toMatchObject({
        stage: 'RESPONDED',
        lostAt: null,
        lostReasonId: null,
        lostNote: null,
      });
    });

    it('preserva a data de perda original ao marcar como perdido', async () => {
      const original = new Date('2026-08-01T00:00:00Z');
      const { svc, updates } = build([{ id: 'p1', lostAt: original }]);

      await svc.bulkStage('org', { ids: ['p1'], stage: 'LOST' });

      expect(updates[0].lostAt).toBe(original);
      expect(updates[0].nextActionAt).toBeNull();
    });

    it('carimba a perda de quem ainda nao tinha', async () => {
      const { svc, updates } = build([{ id: 'p1', lostAt: null }]);

      await svc.bulkStage('org', { ids: ['p1'], stage: 'LOST' });

      expect(updates[0].lostAt).toBeInstanceOf(Date);
    });

    it('recusa bulk sem etapa', async () => {
      const { svc } = build([]);
      await expect(svc.bulkStage('org', { ids: ['p1'] })).rejects.toThrow();
    });
  });

  // ─── Cadência ────────────────────────────────────────────

  describe('registerTouch', () => {
    const dia = 24 * 60 * 60 * 1000;

    // Monta um serviço com prisma mockado o suficiente para exercitar
    // o agendamento do próximo toque.
    function build(prospect: Record<string, unknown>) {
      let updateArgs: Record<string, unknown> = {};
      const prisma = {
        prospect: {
          findFirst: jest.fn().mockResolvedValue(prospect),
          update: jest.fn().mockImplementation((args: Record<string, unknown>) => {
            updateArgs = args;
            return args;
          }),
        },
        prospectTouch: { create: jest.fn().mockImplementation((a: unknown) => a) },
        prospectApproach: { findFirst: jest.fn().mockResolvedValue({ id: 'ap-1' }) },
        $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.resolve(ops)),
      };
      const svc = new ProspectsService(prisma as never, {} as never, {} as never);
      return { svc, prisma, data: () => updateArgs.data as Record<string, unknown> };
    }

    const base = {
      id: 'p1',
      stage: 'NEW',
      touchCount: 0,
      channel: 'INSTAGRAM',
      list: { cadenceDays: [2, 4, 7] },
    };

    it('agenda o próximo toque pela cadência da lista', async () => {
      const { svc, data } = build({ ...base });
      const sentAt = '2026-09-04T12:00:00.000Z';

      await svc.registerTouch('org', 'user', 'p1', { sentAt });

      const d = data();
      expect(d.stage).toBe('CONTACTED');
      // Primeiro intervalo da cadência: +2 dias.
      expect((d.nextActionAt as Date).getTime()).toBe(new Date(sentAt).getTime() + 2 * dia);
    });

    it('usa o intervalo seguinte a cada toque', async () => {
      const { svc, data } = build({ ...base, stage: 'CONTACTED', touchCount: 1 });
      const sentAt = '2026-09-04T12:00:00.000Z';

      await svc.registerTouch('org', 'user', 'p1', { sentAt });

      const d = data();
      expect(d.stage).toBe('FOLLOW_UP');
      expect((d.nextActionAt as Date).getTime()).toBe(new Date(sentAt).getTime() + 4 * dia);
    });

    it('esgota a cadência sem matar o prospect', async () => {
      // Depois do último intervalo não há próxima data. O prospect fica
      // sinalizado no balde "cadência esgotada" da fila, e quem decide
      // enterrar é o operador — não o sistema.
      const { svc, data } = build({ ...base, stage: 'FOLLOW_UP', touchCount: 3 });

      await svc.registerTouch('org', 'user', 'p1', {});

      const d = data();
      expect(d.nextActionAt).toBeNull();
      expect(d.stage).toBe('FOLLOW_UP');
    });

    it('resposta interrompe a cadência e carimba respondedAt', async () => {
      const { svc, data } = build({ ...base, stage: 'CONTACTED', touchCount: 1 });

      await svc.registerTouch('org', 'user', 'p1', { outcome: 'REPLIED_POSITIVE' });

      const d = data();
      expect(d.stage).toBe('RESPONDED');
      expect(d.nextActionAt).toBeNull();
      expect(d.respondedAt).toBeInstanceOf(Date);
    });

    it('resposta negativa também conta como resposta no funil', async () => {
      const { svc, data } = build({ ...base, stage: 'CONTACTED', touchCount: 1 });

      await svc.registerTouch('org', 'user', 'p1', { outcome: 'REPLIED_NEGATIVE' });

      // Recusar é responder. Enterrar é um ato separado (mudar para LOST).
      expect(data().stage).toBe('RESPONDED');
      expect(data().respondedAt).toBeInstanceOf(Date);
    });

    it('não retrocede a etapa de quem já agendou reunião', async () => {
      const { svc, data } = build({
        ...base,
        stage: 'MEETING_SET',
        touchCount: 2,
        respondedAt: new Date('2026-08-01T00:00:00Z'),
      });

      await svc.registerTouch('org', 'user', 'p1', {});

      expect(data().stage).toBe('MEETING_SET');
    });

    it('a data explícita vence a cadência', async () => {
      const { svc, data } = build({ ...base });
      const escolhida = '2026-12-25T09:00:00.000Z';

      await svc.registerTouch('org', 'user', 'p1', { nextActionAt: escolhida });

      expect((data().nextActionAt as Date).toISOString()).toBe(escolhida);
    });

    it('numera o toque a partir do total já registrado', async () => {
      const { svc, prisma } = build({ ...base, stage: 'FOLLOW_UP', touchCount: 2 });

      await svc.registerTouch('org', 'user', 'p1', {});

      expect(prisma.prospectTouch.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sequence: 3 }) }),
      );
    });

    it('prospect sem lista usa a cadência padrão em vez de parar', async () => {
      // Sem fallback o follow-up nunca seria agendado e o prospect
      // cairia direto em "cadência esgotada", parecendo que o sistema
      // desistiu dele — sem erro nenhum na tela.
      const { svc, data } = build({ ...base, list: null });
      const sentAt = '2026-09-04T12:00:00.000Z';

      await svc.registerTouch('org', 'user', 'p1', { sentAt });

      expect(data().stage).toBe('CONTACTED');
      expect((data().nextActionAt as Date).getTime()).toBe(
        new Date(sentAt).getTime() + 2 * dia,
      );
    });

    it('lista com cadência vazia também cai no padrão', async () => {
      const { svc, data } = build({ ...base, list: { cadenceDays: [] } });

      await svc.registerTouch('org', 'user', 'p1', {});

      expect(data().nextActionAt).toBeInstanceOf(Date);
    });
  });
});
