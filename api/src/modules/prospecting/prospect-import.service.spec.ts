import { ProspectImportService } from './prospect-import.service';

/**
 * Trava o caminho de migração da planilha de prospecção para o CRM.
 *
 * A planilha guardava cada follow-up como um par de colunas
 * ("Data do FUP 1" + "FEZ FUP 1?") e a etapa do lead como 11 booleanos
 * soltos. Aqui isso vira linhas em prospect_touches e carimbos
 * monotônicos. Se este arquivo regredir, a importação silenciosamente
 * perde toques — e a taxa de resposta por toque nasce errada.
 */
describe('ProspectImportService', () => {
  const created: Record<string, unknown>[] = [];

  const prisma = {
    prospectList: { findFirst: jest.fn().mockResolvedValue({ id: 'lista-1' }) },
    prospectApproach: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: { name: string } }) =>
          Promise.resolve({ id: `ap-${data.name}`, name: data.name }),
        ),
    },
    prospect: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return Promise.resolve({ id: `p-${created.length}` });
      }),
    },
  };

  const service = new ProspectImportService(prisma as never);
  const call = (name: string, ...args: unknown[]) =>
    (service as unknown as Record<string, (...a: unknown[]) => unknown>)[name](...args);

  beforeEach(() => {
    created.length = 0;
    prisma.prospectApproach.findMany.mockResolvedValue([]);
  });

  // ─── Parsers de célula ───────────────────────────────────

  describe('boolFrom', () => {
    it('entende Sim/Não com e sem acento', () => {
      expect(call('boolFrom', 'Sim')).toBe(true);
      expect(call('boolFrom', 'Não')).toBe(false);
      expect(call('boolFrom', 'nao')).toBe(false);
      expect(call('boolFrom', 'NÃO')).toBe(false);
    });

    it('devolve null para célula vazia — vazio não é "não"', () => {
      // Distinção que importa: na planilha muita célula de FUP está em
      // branco porque o toque nunca aconteceu, não porque foi recusado.
      expect(call('boolFrom', '')).toBeNull();
      expect(call('boolFrom', undefined)).toBeNull();
      expect(call('boolFrom', 'talvez')).toBeNull();
    });
  });

  describe('dateFrom', () => {
    it('lê o formato DD/MM/AAAA da planilha, não como MM/DD', () => {
      const date = call('dateFrom', '25/08/2026') as Date;
      expect(date.toISOString().slice(0, 10)).toBe('2026-08-25');
    });

    it('aceita ISO também', () => {
      const date = call('dateFrom', '2026-08-25') as Date;
      expect(date.toISOString().slice(0, 10)).toBe('2026-08-25');
    });

    it('devolve null em lixo', () => {
      expect(call('dateFrom', '')).toBeNull();
      expect(call('dateFrom', 'sem data')).toBeNull();
    });
  });

  describe('moneyFrom', () => {
    it('converte para centavos, a unidade que o CRM usa', () => {
      // Lead.estimatedValue e centavos e formatCurrency divide por 100.
      // Guardar reais aqui faria o ticket medio sair 100x menor.
      expect(call('moneyFrom', 'R$ 2.500,00')).toBe(250000);
      expect(call('moneyFrom', '1.200')).toBe(120000);
      expect(call('moneyFrom', '997')).toBe(99700);
    });

    it('vira zero quando vazio ou inválido', () => {
      expect(call('moneyFrom', '')).toBe(0);
      expect(call('moneyFrom', '-')).toBe(0);
    });
  });

  describe('handleFrom', () => {
    it('extrai o @ da URL do Instagram — a identidade dos registros antigos', () => {
      expect(call('handleFrom', undefined, 'https://www.instagram.com/sr.pizza/')).toBe(
        'sr.pizza',
      );
      expect(call('handleFrom', undefined, 'https://www.instagram.com/arq.burguer/')).toBe(
        'arq.burguer',
      );
    });

    it('normaliza @ solto e caixa alta para o mesmo handle', () => {
      expect(call('handleFrom', '@LoucoBurguer')).toBe('loucoburguer');
      expect(call('handleFrom', 'loucoburguer/')).toBe('loucoburguer');
    });

    it('não inventa handle a partir de URL de outro domínio', () => {
      expect(call('handleFrom', undefined, 'https://exemplo.com/loja')).toBeNull();
    });
  });

  // ─── Reconstrução dos toques ─────────────────────────────

  describe('buildTouches', () => {
    it('transforma abordagem + 3 FUPs em 4 toques sequenciais', () => {
      const touches = call('buildTouches', {
        touch1Date: '25/08/2026',
        touch1Done: 'Sim',
        fup1Date: '27/08/2026',
        fup1Done: 'Sim',
        fup2Date: '31/08/2026',
        fup2Done: 'Sim',
        fup3Date: '07/09/2026',
        fup3Done: 'Sim',
      }) as { sentAt: Date }[];

      expect(touches).toHaveLength(4);
      expect(touches.map((t) => t.sentAt.toISOString().slice(0, 10))).toEqual([
        '2026-08-25',
        '2026-08-27',
        '2026-08-31',
        '2026-09-07',
      ]);
    });

    it('para no primeiro follow-up que não aconteceu', () => {
      // O caso real da planilha: abordagem enviada, colunas de FUP em
      // branco. Tem que virar 1 toque, não 4.
      const touches = call('buildTouches', {
        touch1Date: '25/08/2026',
        touch1Done: 'Sim',
        fup1Date: '',
        fup1Done: '',
        fup2Date: '',
        fup3Done: 'Não',
      }) as unknown[];

      expect(touches).toHaveLength(1);
    });

    it('não conta "Não" explícito como toque', () => {
      const touches = call('buildTouches', {
        touch1Date: '25/08/2026',
        touch1Done: 'Sim',
        fup1Done: 'Não',
      }) as unknown[];
      expect(touches).toHaveLength(1);
    });

    it('devolve zero toques em linha nunca abordada', () => {
      expect(call('buildTouches', {})).toHaveLength(0);
    });
  });

  // ─── Carimbos monotônicos ────────────────────────────────

  describe('buildStamps', () => {
    const touches = [
      { sentAt: new Date('2026-08-25T12:00:00Z'), outcome: 'NO_REPLY' },
      { sentAt: new Date('2026-08-27T12:00:00Z'), outcome: 'NO_REPLY' },
    ];

    it('preenche as etapas anteriores de quem fechou contrato', () => {
      // A planilha permitia "Fechou Contrato: Sim" com "RESPONDEU: Não".
      // Na importação isso tem que virar uma trilha coerente, senão o
      // funil por coorte perde o registro no meio do caminho.
      const stamps = call(
        'buildStamps',
        { responded: 'Não', meetingSet: '', meetingHeld: '', won: 'Sim' },
        [...touches],
        new Set(),
      ) as Record<string, Date | null | string>;

      expect(stamps.stage).toBe('WON');
      expect(stamps.firstContactedAt).not.toBeNull();
      expect(stamps.respondedAt).not.toBeNull();
      expect(stamps.meetingSetAt).not.toBeNull();
      expect(stamps.meetingHeldAt).not.toBeNull();
      expect(stamps.wonAt).not.toBeNull();
    });

    it('quem só respondeu não ganha carimbo de reunião', () => {
      const stamps = call(
        'buildStamps',
        { responded: 'Sim', meetingSet: 'Não', won: 'Não' },
        [...touches],
        new Set(),
      ) as Record<string, unknown>;

      expect(stamps.stage).toBe('RESPONDED');
      expect(stamps.respondedAt).not.toBeNull();
      expect(stamps.meetingSetAt).toBeNull();
      expect(stamps.wonAt).toBeNull();
    });

    it('marca a resposta no último toque para o corte por toque não nascer zerado', () => {
      const local = [...touches];
      call('buildStamps', { responded: 'Sim' }, local, new Set());
      expect(local[0].outcome).toBe('NO_REPLY');
      expect(local[1].outcome).toBe('REPLIED_POSITIVE');
    });

    it('avisa que as datas de resposta e reunião são aproximadas', () => {
      // Honestidade sobre o dado importado: a planilha não registra
      // QUANDO a resposta veio, então ciclo médio fica aproximado.
      const avisos = new Set<string>();
      call('buildStamps', { responded: 'Sim' }, [...touches], avisos);
      expect([...avisos][0]).toMatch(/aproximad/i);
    });

    it('não avisa quando nada avançou', () => {
      const avisos = new Set<string>();
      call('buildStamps', { responded: 'Não' }, [...touches], avisos);
      expect(avisos.size).toBe(0);
    });

    it('linha sem toque nenhum fica em NEW, fora da coorte do funil', () => {
      const stamps = call('buildStamps', {}, [], new Set()) as Record<string, unknown>;
      expect(stamps.stage).toBe('NEW');
      expect(stamps.firstContactedAt).toBeNull();
    });

    it('marca perda quando não fechou e há motivo escrito', () => {
      const stamps = call(
        'buildStamps',
        { won: 'Não', lostNote: 'Achou caro' },
        [...touches],
        new Set(),
      ) as Record<string, unknown>;
      expect(stamps.stage).toBe('LOST');
      expect(stamps.lostAt).not.toBeNull();
    });
  });

  // ─── Importação ponta a ponta ────────────────────────────

  describe('importCsv', () => {
    // Os cabeçalhos exatos da planilha de origem, com acento e caixa.
    const header =
      'Tem Anuncio?,Link do Instagram,Data da mensagem,Enviou Mensagem?,Principal abordagem,' +
      'Data do FUP 1,FEZ FUP 1?,Data do FUP 2,FEZ FUP 2?,Data do FUP 3,Fez FUP 3?,' +
      'RESPONDEU?,Agendou reunião?,Fez reunião?,Fechou Contrato?,Valor,Se não fechou qual motivo?';

    const csv = (...rows: string[]) => Buffer.from([header, ...rows].join('\n'), 'utf-8');

    it('importa uma linha real da planilha com os cabeçalhos originais', async () => {
      const result = await service.importCsv(
        'org-1',
        'user-1',
        csv(
          'Sim,https://www.instagram.com/sr.pizza/,25/08/2026,Sim,Mensagem A,' +
            ',,,,,,' +
            'Não,Não,,,,',
        ),
        'lista-1',
      );

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.touchesCreated).toBe(1);

      const row = created[0];
      expect(row.handle).toBe('sr.pizza');
      expect(row.hasAds).toBe(true);
      expect(row.stage).toBe('CONTACTED');
      expect(row.touchCount).toBe(1);
      expect(row.firstContactedAt).toBeInstanceOf(Date);
      expect(row.respondedAt).toBeNull();
    });

    it('usa o perfil como nome quando a planilha não tem coluna de nome', async () => {
      await service.importCsv(
        'org-1',
        'user-1',
        csv('Não,https://www.instagram.com/arq.burguer/,25/08/2026,Sim,,,,,,,,,,,,,'),
      );
      expect(created[0].name).toBe('arq.burguer');
    });

    it('reconstrói toda a cadência quando os FUPs foram feitos', async () => {
      await service.importCsv(
        'org-1',
        'user-1',
        csv(
          'Sim,https://www.instagram.com/loucoburguer/,25/08/2026,Sim,Mensagem B,' +
            '27/08/2026,Sim,31/08/2026,Sim,07/09/2026,Sim,' +
            'Sim,Sim,Sim,Sim,"R$ 2.500,00",',
        ),
      );

      const row = created[0];
      expect(row.touchCount).toBe(4);
      expect(row.stage).toBe('WON');
      expect(row.dealValue).toBe(250000);
      expect((row.touches as { create: unknown[] }).create).toHaveLength(4);
    });

    it('cadastra a abordagem no catálogo para o corte por script funcionar', async () => {
      await service.importCsv(
        'org-1',
        'user-1',
        csv('Sim,https://www.instagram.com/o.rei/,25/08/2026,Sim,Elogio + pergunta,,,,,,,,,,,,'),
      );
      expect(prisma.prospectApproach.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { organizationId: 'org-1', name: 'Elogio + pergunta' },
        }),
      );
    });

    it('registra a linha sem identidade em vez de derrubar a importação', async () => {
      const result = await service.importCsv(
        'org-1',
        'user-1',
        csv('Sim,,25/08/2026,Sim,,,,,,,,,,,,,', 'Não,https://www.instagram.com/ok/,25/08/2026,Sim,,,,,,,,,,,,,'),
      );

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors[0]).toMatchObject({ row: 2 });
    });

    it('recusa CSV vazio', async () => {
      await expect(
        service.importCsv('org-1', 'user-1', Buffer.from('', 'utf-8')),
      ).rejects.toThrow(/vazio/i);
    });
  });
});
