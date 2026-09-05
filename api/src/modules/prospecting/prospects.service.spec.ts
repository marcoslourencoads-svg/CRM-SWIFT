import { ProspectsService, rotuloDoProspect } from './prospects.service';

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

  // ─── Identificacao do prospect ───────────────────────────

  describe('rotuloDoProspect', () => {
    // O nome deixou de ser obrigatorio, entao o rotulo precisa achar
    // alguma coisa para mostrar — senao o card, a notificacao e o titulo
    // do lead sairiam em branco.
    it('o negocio lidera', () => {
      expect(rotuloDoProspect({ business: 'Barbearia Imperial', name: 'Rafael' })).toBe(
        'Barbearia Imperial',
      );
    });

    it('sem negocio, usa a pessoa', () => {
      expect(rotuloDoProspect({ name: 'Rafael' })).toBe('Rafael');
    });

    it('sem nenhum dos dois, usa o @ do perfil', () => {
      expect(rotuloDoProspect({ handle: 'barbeariaimperial' })).toBe('@barbeariaimperial');
    });

    it('depois o telefone, depois o e-mail', () => {
      expect(rotuloDoProspect({ phone: '(19) 99999-8888' })).toBe('(19) 99999-8888');
      expect(rotuloDoProspect({ email: 'contato@barbearia.com' })).toBe(
        'contato@barbearia.com',
      );
    });

    it('ignora campo so com espaco', () => {
      expect(rotuloDoProspect({ business: '   ', name: 'Rafael' })).toBe('Rafael');
    });

    it('sem nada, nao devolve string vazia', () => {
      expect(rotuloDoProspect({})).toBe('Sem identificacao');
    });
  });

  describe('create — pelo menos um identificador', () => {
    function build() {
      const prisma = {
        prospect: {
          create: jest.fn().mockImplementation(({ data }: { data: unknown }) =>
            Promise.resolve({ id: 'p1', ...(data as object) }),
          ),
        },
      };
      return new ProspectsService(prisma as never, {} as never, {} as never);
    }

    it('aceita so com o @ do perfil, sem nome', async () => {
      const svc = build();
      await expect(
        svc.create('org', 'u1', { handle: '@barbeariaimperial' }),
      ).resolves.toBeTruthy();
    });

    it('aceita so com telefone', async () => {
      const svc = build();
      await expect(svc.create('org', 'u1', { phone: '19999998888' })).resolves.toBeTruthy();
    });

    it('aceita so com o negocio', async () => {
      const svc = build();
      await expect(
        svc.create('org', 'u1', { business: 'Barbearia Imperial' }),
      ).resolves.toBeTruthy();
    });

    it('recusa quando NADA identifica o prospect', async () => {
      // Sem isto o card nasceria em branco e ninguem saberia de quem e.
      const svc = build();
      await expect(svc.create('org', 'u1', { niche: 'Barbearia' })).rejects.toThrow(
        /identificador/i,
      );
    });

    it('recusa campos so com espaco', async () => {
      const svc = build();
      await expect(
        svc.create('org', 'u1', { name: '  ', business: '', phone: '   ' }),
      ).rejects.toThrow(/identificador/i);
    });
  });

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

  // ─── Cadastro com "ja abordei" e observacao ──────────────

  describe('create', () => {
    function build() {
      let criado: Record<string, unknown> = {};
      let toqueRegistrado: unknown = null;
      const prisma = {
        prospect: {
          create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
            criado = args.data;
            return Promise.resolve({ id: 'p1', ...args.data });
          }),
          findFirst: jest.fn().mockResolvedValue({
            id: 'p1',
            stage: 'NEW',
            touchCount: 0,
            channel: 'INSTAGRAM',
            list: { cadenceDays: [2, 4, 7] },
          }),
          update: jest.fn().mockImplementation((a: unknown) => a),
        },
        prospectTouch: {
          create: jest.fn().mockImplementation((a: unknown) => {
            toqueRegistrado = a;
            return a;
          }),
        },
        prospectApproach: { findFirst: jest.fn().mockResolvedValue({ id: 'ap-1' }) },
        $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.resolve(ops)),
      };
      const svc = new ProspectsService(prisma as never, {} as never, {} as never);
      return { svc, dados: () => criado, toque: () => toqueRegistrado };
    }

    it('a observacao do cadastro vira a primeira entrada do diario', async () => {
      // Antes nao havia onde escrever no cadastro, e o que foi avaliado
      // na hora se perdia ate alguem abrir a ficha.
      const { svc, dados } = build();
      await svc.create('org', 'user-1', {
        name: 'Rafael',
        observacao: 'Fatura ~80k. Nao anuncia.',
      });

      const notes = dados().notes as { create: Record<string, unknown> };
      expect(notes.create).toMatchObject({
        userId: 'user-1',
        stage: 'NEW',
        content: 'Fatura ~80k. Nao anuncia.',
      });
    });

    it('sem observacao nao cria entrada vazia no diario', async () => {
      const { svc, dados } = build();
      await svc.create('org', 'user-1', { name: 'Rafael', observacao: '   ' });
      expect(dados().notes).toBeUndefined();
    });

    it('"ja abordei" registra o primeiro toque junto do cadastro', async () => {
      // Sem isto era preciso salvar, reabrir a ficha e so entao marcar
      // a abordagem — dois passos para o que e um so.
      const { svc, toque } = build();
      await svc.create('org', 'user-1', {
        name: 'Rafael',
        jaAbordado: true,
        primeiroToqueResultado: 'REPLIED_POSITIVE',
      });

      expect(toque()).toMatchObject({
        data: expect.objectContaining({ sequence: 1, outcome: 'REPLIED_POSITIVE' }),
      });
    });

    it('sem "ja abordei" nenhum toque e registrado', async () => {
      const { svc, toque } = build();
      await svc.create('org', 'user-1', { name: 'Rafael' });
      expect(toque()).toBeNull();
    });

    it('quem cadastra vira o dono, para o lembrete ter destinatario', async () => {
      // O scheduler so avisa quem tem ownerId. Sem este padrao, o
      // prospect nasceria sem dono e o sino nunca tocaria por ele.
      const { svc, dados } = build();
      await svc.create('org', 'user-1', { name: 'Rafael' });
      expect(dados().ownerId).toBe('user-1');
    });
  });

  // ─── Fila do dia e fuso ──────────────────────────────────

  describe('getQueue', () => {
    // O bug que motivou isto: cadastrar com a data de hoje marcava o
    // prospect como ATRASADO no ato. A causa estava no front (data lida
    // como meia-noite UTC), mas o servidor tinha o mesmo vicio pelo
    // outro lado: ele decidia o que e "hoje" pelo relogio DELE, que em
    // producao roda em UTC.
    function build() {
      const chamadas: Record<string, unknown>[] = [];
      const prisma = {
        prospect: {
          findMany: jest.fn().mockImplementation((args: Record<string, unknown>) => {
            chamadas.push(args.where as Record<string, unknown>);
            return Promise.resolve([]);
          }),
        },
      };
      const svc = new ProspectsService(prisma as never, {} as never, {} as never);
      return { svc, chamadas };
    }

    it('usa o fuso de quem olha para decidir o comeco do dia', async () => {
      // 180 = UTC-3 (getTimezoneOffset devolve invertido).
      const { svc, chamadas } = build();
      await svc.getQueue('org', undefined, 180);

      const hoje = chamadas.find((w) => {
        const na = w.nextActionAt as { gte?: Date };
        return na?.gte instanceof Date;
      });
      const inicio = (hoje!.nextActionAt as { gte: Date }).gte;

      // Meia-noite em UTC-3 e 03:00 UTC.
      expect(inicio.getUTCHours()).toBe(3);
    });

    it('em UTC o comeco do dia e meia-noite UTC', async () => {
      const { svc, chamadas } = build();
      await svc.getQueue('org', undefined, 0);

      const hoje = chamadas.find((w) => {
        const na = w.nextActionAt as { gte?: Date };
        return na?.gte instanceof Date;
      });
      const inicio = (hoje!.nextActionAt as { gte: Date }).gte;

      expect(inicio.getUTCHours()).toBe(0);
    });

    it('um compromisso para hoje as 14h nao cai no balde de atrasados', async () => {
      // Reproduz o relato: cadastro com data de hoje nascia atrasado.
      const { svc, chamadas } = build();
      const offset = 180;
      await svc.getQueue('org', undefined, offset);

      const atrasados = chamadas.find((w) => {
        const na = w.nextActionAt as { lt?: Date };
        return na?.lt instanceof Date;
      });
      const corte = (atrasados!.nextActionAt as { lt: Date }).lt;

      // Hoje as 14h em UTC-3, montado como o front monta agora.
      const agoraLocal = new Date(Date.now() - offset * 60 * 1000);
      const hojeAs14 = new Date(
        Date.UTC(
          agoraLocal.getUTCFullYear(),
          agoraLocal.getUTCMonth(),
          agoraLocal.getUTCDate(),
          14,
        ) + offset * 60 * 1000,
      );

      expect(hojeAs14.getTime()).toBeGreaterThanOrEqual(corte.getTime());
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
