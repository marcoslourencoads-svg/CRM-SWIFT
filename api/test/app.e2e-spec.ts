import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { ResponseEnvelopeInterceptor } from './../src/common/interceptors/response-envelope.interceptor';
import { GlobalExceptionFilter } from './../src/common/filters/http-exception.filter';

/**
 * Smoke test do aplicativo inteiro: sobe o AppModule de verdade e checa
 * que o grafo de módulos monta, que o banco responde e que os guards
 * globais estão de fato protegendo as rotas.
 *
 * Precisa do banco no ar (docker compose up -d). Rode com:
 *   npm run test:e2e
 *
 * O que veio antes disto era o esqueleto do Nest — batia em `GET /`
 * esperando "Hello World!", rota que este aplicativo nunca teve.
 */
describe('CRM API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Mesmo wiring do main.ts. Os guards vêm do AppModule (APP_GUARD),
    // mas o pipe, o envelope e o filtro são montados no bootstrap — sem
    // repeti-los aqui o teste checaria um aplicativo que não existe.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();
  }, 30000);

  afterAll(async () => {
    await app?.close();
  });

  describe('/health', () => {
    it('responde e enxerga o banco', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);

      expect(res.body.data).toMatchObject({ status: 'ok', db: 'ok' });
    });
  });

  describe('guards globais', () => {
    // O JwtAuthGuard é global (APP_GUARD): rota nova nasce protegida a
    // menos que alguém marque @Public(). Se isso regredir, todo o CRM
    // fica aberto — inclusive a prospecção.
    it.each([
      ['/prospects'],
      ['/prospects/queue'],
      ['/prospect-lists'],
      ['/prospecting/funnel'],
      ['/leads'],
    ])('%s exige autenticação', async (rota) => {
      await request(app.getHttpServer()).get(rota).expect(401);
    });

    it('/health é público de propósito', async () => {
      await request(app.getHttpServer()).get('/health').expect(200);
    });
  });

  describe('envelope de resposta', () => {
    it('embrulha o corpo em { data }', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.body).toHaveProperty('data');
    });
  });
});
