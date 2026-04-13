---
name: Base Conhecimento Bravy
overview: Criar uma base de conhecimento completa em multiplos arquivos .md, pensada para vibecoders de todos os niveis, organizada por jornada (onboarding -> dia-a-dia -> referencia), com um arquivo consolidado para LLMs.
todos:
  - id: doc-00-indice
    content: "docs/standards/00-indice.md — Mapa de navegacao: quem voce e? o que voce precisa? vai direto pro arquivo certo."
    status: pending
  - id: doc-01-onboarding
    content: docs/standards/01-onboarding.md — Boas-vindas, filosofia, glossario tecnico, setup do ambiente, seu primeiro dia
    status: pending
  - id: doc-02-arquitetura
    content: docs/standards/02-arquitetura.md — Visao geral da arquitetura, diagrama, como frontend/backend/banco se conectam, fluxo de uma request
    status: pending
  - id: doc-03-nomenclatura
    content: docs/standards/03-nomenclatura-e-padroes.md — Todas as regras de nomenclatura com tabelas certo/errado + justificativa + cheat sheet
    status: pending
  - id: doc-04-backend
    content: "docs/standards/04-backend.md — NestJS completo: analogias, estrutura de pastas, camadas, CRUD de exemplo inteiro, cada pattern com codigo real"
    status: pending
  - id: doc-05-frontend
    content: "docs/standards/05-frontend.md — Next.js completo: analogias, estrutura de pastas, RSC vs Client, feature de exemplo inteira, patterns com codigo real"
    status: pending
  - id: doc-06-banco
    content: "docs/standards/06-banco-de-dados.md — PostgreSQL + Prisma: schema, migrations, seeding, queries, performance, soft delete"
    status: pending
  - id: doc-07-auth
    content: docs/standards/07-autenticacao.md — Fluxo completo ponta a ponta (backend + frontend), com codigo copiavel de TODOS os arquivos
    status: pending
  - id: doc-08-api
    content: docs/standards/08-api.md — Padroes REST, responses, paginacao, filtros, uploads, status codes
    status: pending
  - id: doc-09-git
    content: docs/standards/09-git-workflow.md — Branches, commits, PRs, code review, .gitignore, comandos essenciais
    status: pending
  - id: doc-10-devops
    content: docs/standards/10-devops.md — Docker, docker-compose, nginx, SSL, CI/CD, deploy, backup, monitoramento
    status: pending
  - id: doc-11-seguranca
    content: docs/standards/11-seguranca.md — Seguranca aplicada ao stack com exemplos praticos e checklist
    status: pending
  - id: doc-12-vibecoding
    content: docs/standards/12-guia-vibecoding.md — Receitas prontas, prompts copiaveis, anti-patterns, checklists, ordem de construcao
    status: pending
  - id: doc-99-consolidado
    content: docs/standards/99-referencia-completa.md — Arquivo unico consolidando TUDO para LLMs consumirem como contexto
    status: pending
  - id: review-final
    content: "Revisao final: links cruzados entre arquivos, consistencia, glossario completo, navegabilidade"
    status: pending
isProject: false
---

# Base de Conhecimento Bravy — Plano de Execucao

## Premissa Fundamental

O publico NAO sao desenvolvedores tradicionais. Sao vibecoders — pessoas de niveis variados (do iniciante ao avancado) que usam LLMs para construir aplicacoes. A documentacao precisa:

- Guiar pela mao, nao apenas listar regras
- Explicar o PORQUE antes do COMO
- Ter glossario para termos tecnicos
- Ser navegavel por "o que estou tentando fazer?" e nao apenas por tecnologia
- Ter receitas prontas que a pessoa copia e pede para a LLM executar

---

## Arquitetura dos Arquivos

```
docs/standards/
├── 00-indice.md                    # Mapa de navegacao inteligente
├── 01-onboarding.md                # Seu primeiro dia na Bravy
├── 02-arquitetura.md               # Como tudo se conecta
├── 03-nomenclatura-e-padroes.md    # A lei de nomes do codigo
├── 04-backend.md                   # Guia completo NestJS
├── 05-frontend.md                  # Guia completo Next.js
├── 06-banco-de-dados.md            # PostgreSQL + Prisma
├── 07-autenticacao.md              # Auth ponta a ponta
├── 08-api.md                       # Padroes de API REST
├── 09-git-workflow.md              # Como versionar codigo
├── 10-devops.md                    # Docker, deploy, infraestrutura
├── 11-seguranca.md                 # Protegendo a aplicacao
├── 12-guia-vibecoding.md           # Receitas, prompts, anti-patterns
└── 99-referencia-completa.md       # TUDO consolidado para LLMs
```

---

## Detalhamento de Cada Arquivo

---

### 00-indice.md — "Quem e voce? O que precisa? Vai direto."

Nao e um indice seco. E um roteador inteligente. O colaborador abre, se identifica na situacao, e vai direto para o arquivo certo.

**Estrutura:**

1. **"Acabei de entrar na Bravy"** -> [01-onboarding.md] — Setup do ambiente, glossario, filosofia
2. **"Preciso entender a arquitetura de um projeto"** -> [02-arquitetura.md] — Como frontend, backend e banco se conectam
3. **"Estou criando/nomeando um arquivo e nao sei o padrao"** -> [03-nomenclatura-e-padroes.md] — Tabelas de referencia rapida certo/errado
4. **"Estou trabalhando no backend"** -> [04-backend.md] — Estrutura de pastas, camadas, patterns
5. **"Estou trabalhando no frontend"** -> [05-frontend.md] — Estrutura de pastas, componentes, patterns
6. **"Estou mexendo no banco de dados"** -> [06-banco-de-dados.md] — Schema, migrations, queries
7. **"Preciso implementar login/autenticacao"** -> [07-autenticacao.md] — Fluxo completo backend + frontend
8. **"Preciso criar ou consumir uma API"** -> [08-api.md] — Endpoints, responses, paginacao
9. **"Preciso commitar/versionar meu codigo"** -> [09-git-workflow.md] — Branches, commits, PRs
10. **"Preciso fazer deploy ou configurar Docker"** -> [10-devops.md] — Dockerfiles, compose, nginx, CI/CD
11. **"Preciso revisar seguranca"** -> [11-seguranca.md] — Checklist de seguranca aplicada
12. **"Quero pedir algo para a LLM e quero fazer certo"** -> [12-guia-vibecoding.md] — Prompts prontos, receitas, anti-patterns
13. **"Sou uma LLM recebendo este documento como contexto"** -> [99-referencia-completa.md] — Tudo em arquivo unico

---

### 01-onboarding.md — "Bem-vindo a Bravy. Leia antes de qualquer coisa."

**Tom:** Conversa direta, como se um colega senior estivesse explicando no cafe.

**Conteudo:**

**1.1 — Filosofia de desenvolvimento da Bravy**

- Velocidade com qualidade: vibecoding permite ambos
- Padronizacao > velocidade: seguir o padrao e mais importante que entregar rapido e bagunçado
- Se nao esta documentado, nao existe
- LLM e ferramenta, nao substituto de pensamento critico

**1.2 — Glossario tecnico essencial (~40 termos)**
Cada termo com:

- Nome
- O que e (1-2 frases, linguagem simples)
- Analogia do mundo real
- Onde voce encontra isso no projeto

Exemplos:

- **API**: "E a porta de entrada do seu backend. O frontend bate nessa porta para pedir ou enviar dados."
- **DTO**: "E o 'formulario' que define exatamente quais campos uma request precisa ter."
- **Migration**: "E um 'commit' do banco de dados. Cada mudanca na estrutura das tabelas vira uma migration."
- **Middleware**: "E o 'porteiro'. Toda request passa por ele antes de chegar no destino."
- **ORM (Prisma)**: "E o tradutor entre o TypeScript e o PostgreSQL."

Lista completa: endpoint, route, controller, service, repository, module, guard, pipe, interceptor, filter, decorator, token JWT, hash, seed, schema, model, enum, hook, component, provider, store, context, server component, client component, server action, SSR, SSG, ISR, CORS, CSRF, XSS, SQL injection, environment variable, Docker container, image, volume, CI/CD, PR, branch, merge, rebase, etc.

**1.3 — A Stack Bravy (com justificativa para cada escolha)**

Para cada tecnologia: o que e, por que a Bravy escolheu, o que substitui, link oficial.

| Tecnologia           | Papel           | Por que?                                 |
| -------------------- | --------------- | ---------------------------------------- |
| TypeScript           | Linguagem       | JavaScript com tipos = menos bugs        |
| NestJS               | Backend         | Estrutura organizada, modular, escalavel |
| Next.js (App Router) | Frontend        | React com SSR, SEO, rotas automaticas    |
| PostgreSQL           | Banco de dados  | Robusto, open source, o mais usado       |
| Prisma               | ORM             | Escreve TypeScript, nao SQL. Type-safe.  |
| Tailwind CSS         | Estilizacao     | Rapido, utility-first, sem CSS bagunçado |
| shadcn/ui            | Componentes UI  | Bonito, acessivel, customizavel          |
| Docker               | Containerizacao | Funciona em qualquer lugar               |
| JWT                  | Autenticacao    | Tokens stateless, escalavel              |

**1.4 — Setup do ambiente (passo a passo, macOS e Linux)**

1. Instalar Node.js 20+ (via nvm — comandos exatos)
2. Instalar Docker Desktop
3. Instalar Git
4. Configurar VS Code / Cursor (extensoes obrigatorias listadas)
5. Configurar Claude Code / LLM
6. Clonar repositorio de exemplo
7. Rodar `docker-compose up` e ver funcionando
8. Testar endpoint no navegador

**1.5 — Extensoes obrigatorias do VS Code / Cursor**
Lista com nome exato + o que faz.

**1.6 — Seu primeiro dia: checklist numerado**

1. Ler este documento (01) inteiro
2. Fazer setup do ambiente
3. Ler 02-arquitetura.md
4. Ler 03-nomenclatura-e-padroes.md (referencia diaria)
5. Ler guia da sua area (04 ou 05)
6. Ler 12-guia-vibecoding.md
7. Pegar primeira tarefa

---

### 02-arquitetura.md — "Como tudo se conecta"

**Tom:** Visual e didatico. Muitos diagramas.

**2.1 — Visao de helicoptero**
Diagrama Mermaid: Usuario -> Navegador -> Next.js -> API NestJS -> PostgreSQL.
Explicacao de cada seta.

**2.2 — Anatomia de uma request (do clique ao banco e de volta)**
Narrativa passo a passo com 14 etapas, desde o clique do usuario ate a UI atualizar.
Cada passo com o arquivo exato onde o codigo mora.

```
1. Usuario clica "Salvar" no formulario
2. React Hook Form valida com Zod
3. useMutation do React Query dispara
4. Service HTTP chama o endpoint
5. Axios injeta Bearer token (interceptor)
6. Request chega no NestJS
7. ValidationPipe valida body via DTO
8. JwtAuthGuard verifica token
9. Controller delega para Service
10. Service aplica logica, chama Repository
11. Repository executa query via Prisma
12. Prisma converte para SQL -> PostgreSQL
13. Response sobe: Repo -> Service -> Controller -> Interceptor envelopa
14. React Query atualiza cache -> UI renderiza
```

**2.3 — Repositorios: como organizar**

- `bravy-{projeto}-api` e `bravy-{projeto}-web`
- Repos independentes, comunicam via API REST

**2.4 — Ambientes (local, staging, producao)**
Tabela com URL, banco, Docker, proposito de cada.

**2.5 — Diagrama de pastas lado a lado**
Backend e Frontend lado a lado com setas conectando (DTO <-> Type).

---

### 03-nomenclatura-e-padroes.md — "A lei sagrada dos nomes"

**Tom:** Prescritivo. Zero ambiguidade. Consulta diaria.

**Formato de cada regra:** Regra em negrito + tabela CERTO/ERRADO + exemplo de codigo + "Por que?" explicando o motivo.

**Secoes:**

**3.1 — Arquivos e Pastas (~15 regras)**
Inclui: arquivos TS, componentes React, testes, testes e2e, pastas, configs, sufixos NestJS (.module.ts, .controller.ts, .service.ts, .guard.ts, .pipe.ts, .interceptor.ts, .filter.ts, .decorator.ts, .dto.ts), sufixos Next.js (page.tsx, layout.tsx, loading.tsx, error.tsx, not-found.tsx), hooks (prefixo use-), contextos (.context.tsx), tipos (.types.ts), constantes (.constants.ts), utils (.utils.ts).

Cada regra com justificativa. Ex: "Usamos kebab-case em arquivos porque e case-insensitive no macOS, evitando bugs ao importar."

**3.2 — Classes, Interfaces, Types, Enums (~5 regras)**
PascalCase + sufixo do papel. SEM prefixo I em interfaces. UPPER_SNAKE nos valores de enum.

**3.3 — Variaveis, Funcoes, Metodos (~6 regras)**
camelCase para vars. UPPER_SNAKE para constantes. Verbo no inicio de funcoes. Prefixos booleanos (is, has, can, should). Prefixo handle/on para React events.

**3.4 — Componentes React (~5 regras)**
Arquivo kebab-case, export PascalCase. Props: `{Nome}Props`. Um componente por arquivo. Separar Server/Client.

**3.5 — Banco de Dados / Prisma Schema (~6 regras)**
Models PascalCase singular. Colunas camelCase. @@map para snake_case no banco. Indices nomeados.

**3.6 — Endpoints de API (~4 regras)**
Base /api/v1/. Recursos kebab-case plural. Acoes como sub-recurso. Query params camelCase.

**3.7 — Git: branches, commits, tags (~3 regras)**
Branches tipo/descricao-kebab. Conventional Commits. Semver.

**3.8 — Variaveis de Ambiente (~3 regras)**
UPPER*SNAKE. NEXT_PUBLIC* para client. Prefixo por servico.

**3.9 — Cheat Sheet (cola rapida)**
Tabela unica resumindo TODAS as regras em ~15 linhas. Para consulta instantanea no dia a dia.

---

### 04-backend.md — "Guia do Backend NestJS"

**Tom:** Tutorial progressivo. Começa simples, vai aprofundando.

**4.1 — "O que e o NestJS e por que usar?"**
Analogia com empresa:

- Module = departamento
- Controller = recepcionista (recebe pedidos, encaminha)
- Service = especialista (faz o trabalho)
- Repository = arquivista (acessa o banco)
- Guard = seguranca (barra quem nao tem acesso)
- Pipe = inspetor de qualidade (valida o que entra)
- Interceptor = gerente (transforma o que sai)
- Filter = bombeiro (lida com erros)

**4.2 — Estrutura de pastas completa (~50 arquivos)**
Arvore com CADA pasta e arquivo tendo:

- O que e (1 frase)
- Quando voce mexe nele
- Exemplo de codigo minimo

**4.3 — O fluxo de uma feature: CRUD de Produtos passo a passo**
Exemplo concreto com codigo COMPLETO (nao fragmento) de cada arquivo:

1. Criar pasta `src/modules/products/`
2. `products.module.ts`
3. DTOs: `create-product.dto.ts`, `update-product.dto.ts`, `product-response.dto.ts`
4. `products.repository.ts`
5. `products.service.ts`
6. `products.controller.ts` com Swagger
7. Registrar no `app.module.ts`
8. Testar

**4.4 — Camada por camada (referencia detalhada)**
Para cada camada (Controller, Service, Repository, DTO, Guard, Pipe, Interceptor, Filter, Decorator):

- O que e / O que NAO pode fazer
- Template de codigo padrao
- Exemplo real
- Anti-pattern da LLM

**4.5 — Configuracao global**

- `main.ts` completo
- `.env` e `@nestjs/config`
- ESLint + Prettier configs

**4.6 — Testes**

- Jest config
- Teste unitario de Service (mockando Repository)
- Teste e2e (supertest)
- Regra: todo service deve ter testes

---

### 05-frontend.md — "Guia do Frontend Next.js"

**Mesma filosofia do 04-backend.md.**

**5.1 — "O que e o Next.js e por que usar?"**
Server Components vs Client Components: "cozinhar na cozinha do restaurante (server) vs na mesa do cliente (client)".

**5.2 — Estrutura de pastas completa (~60 arquivos)**
Com explicacao e regras de colocacao:

```
1 feature? -> features/{feature}/components/
2+ features? -> components/shared/
UI generico? -> components/ui/ (shadcn)
Layout? -> components/layout/
```

**5.3 — Server Component ou Client Component?**
Fluxograma de decisao:

```
Precisa de useState/useEffect/onClick/onChange/hooks de browser?
  SIM -> "use client"
  NAO -> Server Component (default)
```

**5.4 — Feature completa de exemplo: Listagem e Cadastro de Produtos**
Codigo completo de cada arquivo:

1. Types, 2. Schema Zod, 3. Service HTTP, 4. Hooks, 5. Componentes, 6. Paginas, 7. Rota no sidebar

**5.5 — Patterns de codigo**
Data fetching (RSC vs React Query), formularios (RHF + Zod), estado (Zustand), HTTP Client (axios + interceptors), Loading/Error, Tailwind + cn(), shadcn/ui.

**5.6 — Performance e SEO**
Image optimization, dynamic imports, Metadata API, next/font.

---

### 06-banco-de-dados.md — "PostgreSQL + Prisma"

**6.1 — O que e o Prisma?** (analogia simples)
**6.2 — Schema: como modelar dados** (regras, campos obrigatorios, exemplo completo User + Organization + Product)
**6.3 — Migrations** (criar, aplicar, resolver conflitos)
**6.4 — Seed** (script completo)
**6.5 — Queries e patterns avancados** (transacoes, soft delete middleware, paginacao reutilizavel, $queryRaw, select/include)
**6.6 — Performance** (connection pooling, N+1, indices)

---

### 07-autenticacao.md — "Login, tokens e protecao de rotas"

Cobre backend E frontend num unico fluxo.

**7.1 — Visao geral** (diagrama: Register -> Login -> Tokens -> Rotas -> Refresh -> Logout)
**7.2 — Backend: codigo COMPLETO** de todos os arquivos (module, controller, service, strategies, guards, decorators, DTOs, Prisma schema)
**7.3 — Frontend: codigo COMPLETO** (api.ts com interceptors, auth provider, hooks, service, login form, middleware.ts)
**7.4 — RBAC** (enum de roles, proteger endpoint por role, esconder UI por role)

---

### 08-api.md — "Padroes de API REST"

- "O que e REST?" (5 linhas para iniciantes)
- Verbos HTTP com analogia (GET=consultar, POST=criar, PATCH=editar, DELETE=remover)
- Mapeamento completo (GET /resources, GET /:id, POST, PATCH /:id, DELETE /:id)
- Response envelope padrao: `{ data, meta }` com JSON de exemplo
- Error response padrao: `{ statusCode, message, error, timestamp, path }`
- Tabela de status codes obrigatorios (200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500)
- Paginacao: offset-based como padrao, cursor-based para feeds
- Filtros, ordenacao, busca (query params padronizados)
- Upload (multipart, max 10MB, validacao de mimetype)

---

### 09-git-workflow.md — "Como versionar codigo"

- "O que e Git?" (para iniciantes)
- 10 comandos essenciais que voce usa todo dia (com explicacao)
- Branches: main, develop, feat/, fix/, hotfix/, chore/, refactor/
- Conventional Commits obrigatorio (com exemplos)
- Fluxo visual de uma feature (diagrama: branch -> commits -> PR -> review -> merge)
- Template de PR pronto para copiar
- .gitignore padrao

---

### 10-devops.md — "Docker, Deploy e Infraestrutura"

- "O que e Docker?" (analogia container de navio)
- "O que e docker-compose?" (receita de containers)
- Dockerfile NestJS completo (multi-stage)
- Dockerfile Next.js completo (multi-stage standalone)
- docker-compose.yml para dev (api + web + postgres + pgadmin + redis)
- docker-compose.prod.yml (api + web + postgres + nginx + certbot)
- nginx.conf completo (reverse proxy, SSL, gzip, security headers)
- GitHub Actions CI/CD workflow completo
- .env.example template obrigatorio
- Health check endpoint
- Backup PostgreSQL (pg_dump + rotacao)
- Checklist de deploy

---

### 11-seguranca.md — "Protegendo a aplicacao"

Cada item com: o que e, como proteger no nosso stack, codigo.

- Helmet, CORS, rate limiting, ValidationPipe, SQL Injection, XSS, CSRF, secrets, npm audit, HTTPS, bcrypt, JWT
- Checklist de seguranca pre-deploy
- "O que pode dar errado?" — cenarios reais de vulnerabilidade

---

### 12-guia-vibecoding.md — "Como usar LLMs do jeito certo"

**Secao mais importante para o publico da Bravy.**

**12.1 — Regras de ouro do vibecoding**

1. Sempre passe a documentacao como contexto
2. Seja especifico
3. Revise TUDO antes de aceitar
4. Corrija desvios imediatamente
5. Uma tarefa por vez

**12.2 — System prompt padrao (texto pronto para copiar)**

**12.3 — Receitas prontas (~15 prompts copiaveis)**
Para tarefas comuns: criar modulo NestJS, criar tela de listagem, adicionar model Prisma, implementar paginacao, etc.

**12.4 — Anti-patterns (~20 items)**
Cada um com: o que a LLM faz, por que esta errado, o que deveria fazer.

**12.5 — Checklist de inicio de projeto** (ordem obrigatoria com prompts)
**12.6 — Checklist de nova feature** (Prisma -> migration -> repo -> service -> DTOs -> controller -> tipos -> service HTTP -> hooks -> componentes -> pagina)
**12.7 — Checklist pre-deploy**

---

### 99-referencia-completa.md — "Arquivo unico para LLMs"

Concatenacao de TODOS os arquivos acima em um unico .md com:

- Header com instrucoes para a LLM (papel, stack, regras inviolaveis)
- Conteudo tecnico direto (sem analogias/explicacoes pedagogicas)
- Otimizado para context windows

---

## Decisoes de Execucao

- **Linguagem:** Portugues (Brasil) para texto, Ingles para codigo e naming
- **Tom:** Didatico e acolhedor nos arquivos 00-02. Prescritivo e assertivo nos arquivos 03-11. Pratico e hands-on no arquivo 12.
- **Codigo:** TypeScript real, funcional, copiavel. Nao pseudocodigo.
- **Estimativa total:** ~4000-5000 linhas distribuidas em 14 arquivos
- **Formato:** Markdown puro, sem dependencias de renderizacao especial
