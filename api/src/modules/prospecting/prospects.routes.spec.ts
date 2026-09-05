import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { ProspectsController } from './prospects.controller';
import { ProspectsService } from './prospects.service';
import { ProspectImportService } from './prospect-import.service';

/**
 * Prova que as rotas do controller resolvem para o método certo.
 *
 * O risco concreto: no Nest a ordem de declaração decide o roteamento, e
 * `GET /prospects/queue` seria engolido por `GET /prospects/:id` se
 * estivesse depois — a fila do dia devolveria "prospect nao encontrado"
 * sem nenhum erro de compilação. O mesmo vale para as rotas `bulk/*`
 * contra `PATCH /prospects/:id` (a mesma pegadinha já anotada em
 * leads.controller.ts).
 *
 * Também trava o contrato de validação dos DTOs, que é global no main.ts.
 */
describe('ProspectsController (rotas)', () => {
  let app: INestApplication;

  const service = {
    findAll: jest.fn().mockResolvedValue([]),
    getQueue: jest.fn().mockResolvedValue({ counts: {} }),
    findOne: jest.fn().mockResolvedValue({ id: 'p1' }),
    create: jest.fn().mockResolvedValue({ id: 'novo' }),
    update: jest.fn().mockResolvedValue({ id: 'p1' }),
    remove: jest.fn().mockResolvedValue(undefined),
    registerTouch: jest.fn().mockResolvedValue({ id: 'p1' }),
    changeStage: jest.fn().mockResolvedValue({ id: 'p1' }),
    convert: jest.fn().mockResolvedValue({}),
    bulkAssign: jest.fn().mockResolvedValue({ updated: 2 }),
    bulkList: jest.fn().mockResolvedValue({ updated: 2 }),
    bulkStage: jest.fn().mockResolvedValue({ updated: 2 }),
    bulkDelete: jest.fn().mockResolvedValue({ deleted: 2 }),
    addNote: jest.fn().mockResolvedValue({ id: 'p1' }),
    getAgenda: jest.fn().mockResolvedValue([]),
  };

  const importService = {
    importCsv: jest.fn().mockResolvedValue({ imported: 0 }),
    exportCsv: jest.fn().mockResolvedValue('Nome\n'),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProspectsController],
      providers: [
        { provide: ProspectsService, useValue: service },
        { provide: ProspectImportService, useValue: importService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    // Em producao quem popula request.user sao os guards globais
    // (JwtAuthGuard -> OrgMemberGuard). Aqui o controller e montado
    // isolado, entao o usuario e injetado para que @CurrentUser e
    // @CurrentOrg resolvam como resolvem de verdade.
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: unknown }).user = {
        sub: 'user-1',
        email: 'bob@exemplo.com',
        orgId: 'org-1',
        role: 'ADMIN',
      };
      next();
    });

    // Mesmo pipe do main.ts, para o teste valer como contrato de entrada.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  describe('rotas fixas nao podem ser engolidas por :id', () => {
    it('GET /prospects/queue chama getQueue, nao findOne', async () => {
      await request(app.getHttpServer()).get('/prospects/queue').expect(200);

      expect(service.getQueue).toHaveBeenCalled();
      expect(service.findOne).not.toHaveBeenCalled();
    });

    it('GET /prospects/export chama o exportador, nao findOne', async () => {
      const res = await request(app.getHttpServer()).get('/prospects/export').expect(200);

      expect(importService.exportCsv).toHaveBeenCalled();
      expect(service.findOne).not.toHaveBeenCalled();
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/prospeccao\.csv/);
    });

    it('PATCH /prospects/bulk/stage chama bulkStage, nao update', async () => {
      await request(app.getHttpServer())
        .patch('/prospects/bulk/stage')
        .send({ ids: ['a', 'b'], stage: 'CONTACTED' })
        .expect(200);

      expect(service.bulkStage).toHaveBeenCalled();
      expect(service.update).not.toHaveBeenCalled();
    });

    it('PATCH /prospects/bulk/assign chama bulkAssign, nao update', async () => {
      await request(app.getHttpServer())
        .patch('/prospects/bulk/assign')
        .send({ ids: ['a'], ownerId: 'u1' })
        .expect(200);

      expect(service.bulkAssign).toHaveBeenCalled();
      expect(service.update).not.toHaveBeenCalled();
    });

    it('GET /prospects/agenda chama getAgenda, nao findOne', async () => {
      await request(app.getHttpServer())
        .get('/prospects/agenda?from=2026-09-01&to=2026-09-30')
        .expect(200);

      expect(service.getAgenda).toHaveBeenCalled();
      expect(service.findOne).not.toHaveBeenCalled();
    });

    it('GET /prospects/agenda sem periodo e recusado', async () => {
      await request(app.getHttpServer()).get('/prospects/agenda').expect(400);
      expect(service.getAgenda).not.toHaveBeenCalled();
    });

    it('GET /prospects/:id continua funcionando para id de verdade', async () => {
      await request(app.getHttpServer()).get('/prospects/ckabc123').expect(200);

      expect(service.findOne).toHaveBeenCalledWith('org-1', 'ckabc123');
      expect(service.getQueue).not.toHaveBeenCalled();
    });
  });

  describe('rotas de acao', () => {
    it('POST /prospects/:id/touches registra o toque', async () => {
      await request(app.getHttpServer())
        .post('/prospects/p1/touches')
        .send({ outcome: 'REPLIED_POSITIVE' })
        .expect(201);

      expect(service.registerTouch).toHaveBeenCalled();
    });

    it('PATCH /prospects/:id/stage muda a etapa', async () => {
      await request(app.getHttpServer())
        .patch('/prospects/p1/stage')
        .send({ stage: 'MEETING_SET' })
        .expect(200);

      expect(service.changeStage).toHaveBeenCalled();
    });

    it('POST /prospects/:id/convert converte em lead', async () => {
      await request(app.getHttpServer())
        .post('/prospects/p1/convert')
        .send({ pipelineId: 'pipe1' })
        .expect(201);

      expect(service.convert).toHaveBeenCalled();
    });

    it('POST /prospects/:id/notes grava no diario', async () => {
      await request(app.getHttpServer())
        .post('/prospects/p1/notes')
        .send({ content: 'Pediu para retornar terca 14h.' })
        .expect(201);

      expect(service.addNote).toHaveBeenCalled();
    });

    it('recusa anotacao vazia', async () => {
      await request(app.getHttpServer())
        .post('/prospects/p1/notes')
        .send({ content: '' })
        .expect(400);
    });

    it('DELETE /prospects/:id devolve 204', async () => {
      await request(app.getHttpServer()).delete('/prospects/p1').expect(204);
      expect(service.remove).toHaveBeenCalled();
    });
  });

  describe('validacao de entrada', () => {
    it('recusa criar prospect sem nome', async () => {
      await request(app.getHttpServer()).post('/prospects').send({}).expect(400);
      expect(service.create).not.toHaveBeenCalled();
    });

    it('cria com apenas o nome — o resto e opcional', async () => {
      await request(app.getHttpServer())
        .post('/prospects')
        .send({ name: 'Rafael Souza' })
        .expect(201);

      expect(service.create).toHaveBeenCalledWith('org-1', 'user-1', { name: 'Rafael Souza' });
    });

    it('recusa etapa que nao existe no enum', async () => {
      await request(app.getHttpServer())
        .patch('/prospects/p1/stage')
        .send({ stage: 'TALVEZ' })
        .expect(400);

      expect(service.changeStage).not.toHaveBeenCalled();
    });

    it('recusa campo desconhecido, em vez de ignorar em silencio', async () => {
      // forbidNonWhitelisted: impede o cliente de mandar `stage`, um
      // carimbo cru, ou o antigo `notes` de texto solto — que agora tem
      // endpoint proprio — e achar que o servidor obedeceu.
      await request(app.getHttpServer())
        .patch('/prospects/p1')
        .send({ name: 'ok', notes: 'texto solto' })
        .expect(400);

      expect(service.update).not.toHaveBeenCalled();
    });

    it('recusa bulk sem ids', async () => {
      await request(app.getHttpServer())
        .patch('/prospects/bulk/stage')
        .send({ ids: [], stage: 'CONTACTED' })
        .expect(400);
    });

    it('recusa converter sem pipelineId', async () => {
      await request(app.getHttpServer())
        .post('/prospects/p1/convert')
        .send({})
        .expect(400);

      expect(service.convert).not.toHaveBeenCalled();
    });
  });
});
