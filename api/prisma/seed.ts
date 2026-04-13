import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('123456', 12);

  // Create demo organization
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-corp' },
    update: {},
    create: {
      name: 'Demo Corp',
      slug: 'demo-corp',
    },
  });

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      name: 'JP Admin',
      email: 'admin@demo.com',
      passwordHash,
    },
  });

  // Create member users
  const member1 = await prisma.user.upsert({
    where: { email: 'marcelao@demo.com' },
    update: {},
    create: {
      name: 'Marcelão',
      email: 'marcelao@demo.com',
      passwordHash,
    },
  });

  const member2 = await prisma.user.upsert({
    where: { email: 'ana@demo.com' },
    update: {},
    create: {
      name: 'Ana Silva',
      email: 'ana@demo.com',
      passwordHash,
    },
  });

  // Create memberships
  const memberships = [
    { userId: admin.id, organizationId: org.id, role: 'OWNER' as const },
    { userId: member1.id, organizationId: org.id, role: 'MEMBER' as const },
    { userId: member2.id, organizationId: org.id, role: 'MEMBER' as const },
  ];

  for (const m of memberships) {
    await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: m.userId,
          organizationId: m.organizationId,
        },
      },
      update: {},
      create: m,
    });
  }

  // Create pipelines
  const existingPipeline = await prisma.pipeline.findFirst({
    where: { organizationId: org.id, name: 'Vendas B2B' },
  });

  if (!existingPipeline) {
    await prisma.pipeline.create({
      data: {
        organizationId: org.id,
        name: 'Vendas B2B',
        description: 'Pipeline principal de vendas',
        position: 0,
        statuses: {
          create: [
            { name: 'Novo', color: '#6B7280', isDefault: true, position: 0 },
            { name: 'Em contato', color: '#3B82F6', position: 1 },
            { name: 'Qualificado', color: '#8B5CF6', isMql: true, position: 2 },
            { name: 'Reunião agendada', color: '#F59E0B', isMeeting: true, position: 3 },
            { name: 'Proposta enviada', color: '#EC4899', position: 4 },
            { name: 'Negociação', color: '#F97316', position: 5 },
            { name: 'Ganho', color: '#10B981', isFinal: true, isWon: true, position: 6 },
            { name: 'Perdido', color: '#EF4444', isFinal: true, isWon: false, position: 7 },
          ],
        },
      },
    });

    await prisma.pipeline.create({
      data: {
        organizationId: org.id,
        name: 'Inbound Marketing',
        description: 'Leads que chegam por marketing digital',
        position: 1,
        statuses: {
          create: [
            { name: 'Lead', color: '#6B7280', isDefault: true, position: 0 },
            { name: 'MQL', color: '#8B5CF6', isMql: true, position: 1 },
            { name: 'SQL', color: '#3B82F6', position: 2 },
            { name: 'Oportunidade', color: '#F59E0B', isMeeting: true, position: 3 },
            { name: 'Cliente', color: '#10B981', isFinal: true, isWon: true, position: 4 },
            { name: 'Descartado', color: '#EF4444', isFinal: true, isWon: false, position: 5 },
          ],
        },
      },
    });

    console.log('  Pipelines: Vendas B2B (8 statuses), Inbound Marketing (6 statuses)');
  }

  // ─── Create 50 Leads ──────────────────────────────────────
  const existingLeads = await prisma.lead.count({
    where: { organizationId: org.id },
  });

  if (existingLeads === 0) {
    // Fetch pipelines with their statuses
    const vendasB2B = await prisma.pipeline.findFirst({
      where: { organizationId: org.id, name: 'Vendas B2B' },
      include: { statuses: { orderBy: { position: 'asc' } } },
    });

    const inboundMkt = await prisma.pipeline.findFirst({
      where: { organizationId: org.id, name: 'Inbound Marketing' },
      include: { statuses: { orderBy: { position: 'asc' } } },
    });

    if (vendasB2B && inboundMkt) {
      const assignees = [admin.id, member1.id, member2.id];
      const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
      const temperatures = ['COLD', 'WARM', 'HOT'] as const;

      // B2B leads data (30 leads)
      const b2bLeads = [
        { title: 'Projeto CRM Empresa Almeida', company: 'Almeida & Filhos Ltda', contact: 'Roberto Almeida', email: 'roberto@almeida.com.br', phone: '11987654321', value: 350000 },
        { title: 'Implementação ERP Logística Sul', company: 'Logística Sul SA', contact: 'Fernanda Costa', email: 'fernanda@logisticasul.com.br', phone: '51991234567', value: 480000 },
        { title: 'Consultoria TI Grupo Matarazzo', company: 'Grupo Matarazzo', contact: 'Carlos Matarazzo', email: 'carlos@grupomatarazzo.com.br', phone: '11976543210', value: 250000 },
        { title: 'Automação Industrial Metalforte', company: 'Metalforte Indústria', contact: 'Paulo Henrique Santos', email: 'paulo@metalforte.ind.br', phone: '19988776655', value: 150000 },
        { title: 'Sistema de Vendas Rede Farma', company: 'Rede Farma Brasil', contact: 'Juliana Oliveira', email: 'juliana@redefarma.com.br', phone: '21998877665', value: 200000 },
        { title: 'Migração Cloud TechBR', company: 'TechBR Solutions', contact: 'André Souza', email: 'andre@techbr.io', phone: '11955443322', value: 420000 },
        { title: 'BI e Analytics Construtora Prado', company: 'Construtora Prado', contact: 'Marcos Prado', email: 'marcos@construtoraprado.com.br', phone: '31987654321', value: 180000 },
        { title: 'App Mobile Supermercados Bom Preço', company: 'Supermercados Bom Preço', contact: 'Luciana Ferreira', email: 'luciana@bompreco.com.br', phone: '81991234567', value: 300000 },
        { title: 'Integração SAP Agro Forte', company: 'Agro Forte Participações', contact: 'Ricardo Campos', email: 'ricardo@agroforte.agr.br', phone: '62988776655', value: 500000 },
        { title: 'Website E-commerce Moda Bella', company: 'Moda Bella EIRELI', contact: 'Patrícia Lima', email: 'patricia@modabella.com.br', phone: '11944332211', value: 75000 },
        { title: 'Sistema RH Grupo Estrela', company: 'Grupo Estrela', contact: 'Renato Barbosa', email: 'renato@grupoestrela.com.br', phone: '41999887766', value: 220000 },
        { title: 'Plataforma LMS Educação Plus', company: 'Educação Plus Ltda', contact: 'Camila Rodrigues', email: 'camila@educacaoplus.com.br', phone: '21987654321', value: 130000 },
        { title: 'Segurança da Informação Banco Horizonte', company: 'Banco Horizonte', contact: 'Felipe Mendes', email: 'felipe@bancohorizonte.com.br', phone: '11933221100', value: 450000 },
        { title: 'Dashboard Gerencial Distribuidora Nacional', company: 'Distribuidora Nacional', contact: 'Adriana Torres', email: 'adriana@distnacional.com.br', phone: '47988776655', value: 95000 },
        { title: 'Chatbot Atendimento Seguradora Vida', company: 'Seguradora Vida Nova', contact: 'Gustavo Pereira', email: 'gustavo@vidanova.seg.br', phone: '11966554433', value: 180000 },
        { title: 'Sistema de Frotas TransLog', company: 'TransLog Transportes', contact: 'Marcelo Duarte', email: 'marcelo@translog.com.br', phone: '71991234567', value: 270000 },
        { title: 'Projeto IoT Fábrica Inovação', company: 'Fábrica Inovação SA', contact: 'Tatiana Nunes', email: 'tatiana@fabricainovacao.ind.br', phone: '19977665544', value: 380000 },
        { title: 'CRM Imobiliária Casa Forte', company: 'Imobiliária Casa Forte', contact: 'Daniel Moreira', email: 'daniel@casaforte.imb.br', phone: '81988776655', value: 120000 },
        { title: 'ERP Financeiro Capital Invest', company: 'Capital Invest DTVM', contact: 'Isabela Carvalho', email: 'isabela@capitalinvest.com.br', phone: '11922110099', value: 490000 },
        { title: 'Automação Marketing Digital BrandUp', company: 'BrandUp Marketing', contact: 'Thiago Nascimento', email: 'thiago@brandup.com.br', phone: '21977665544', value: 65000 },
        { title: 'Sistema Hospitalar Clínica Saúde', company: 'Clínica Saúde Total', contact: 'Marina Ribeiro', email: 'marina@saudetotal.med.br', phone: '31999887766', value: 340000 },
        { title: 'Plataforma Logística Porto Seguro', company: 'Porto Seguro Logística', contact: 'Alexandre Vieira', email: 'alexandre@psl.com.br', phone: '13988776655', value: 290000 },
        { title: 'App Delivery Sabor da Terra', company: 'Sabor da Terra Restaurantes', contact: 'Beatriz Gomes', email: 'beatriz@sabordaterra.com.br', phone: '11955667788', value: 85000 },
        { title: 'Sistema Contábil Auditoria Express', company: 'Auditoria Express', contact: 'Eduardo Martins', email: 'eduardo@auditoriaexpress.com.br', phone: '41988776655', value: 160000 },
        { title: 'Infraestrutura Cloud Energia Verde', company: 'Energia Verde SA', contact: 'Simone Araújo', email: 'simone@energiaverde.com.br', phone: '61991234567', value: 410000 },
        { title: 'Portal do Aluno UniTech', company: 'UniTech Educação', contact: 'Lucas Cardoso', email: 'lucas@unitech.edu.br', phone: '11944556677', value: 230000 },
        { title: 'Gestão de Projetos ArqDesign', company: 'ArqDesign Arquitetura', contact: 'Vanessa Lopes', email: 'vanessa@arqdesign.arq.br', phone: '21966554433', value: 55000 },
        { title: 'Marketplace Artesanato Brasil', company: 'Artesanato Brasil Coop', contact: 'José Carlos Silva', email: 'josecarlos@artbrasil.coop.br', phone: '92988776655', value: 45000 },
        { title: 'Sistema de Qualidade FarmaCorp', company: 'FarmaCorp Indústria', contact: 'Priscila Monteiro', email: 'priscila@farmacorp.ind.br', phone: '19966554433', value: 310000 },
        { title: 'Painel de Controle Petro Energy', company: 'Petro Energy SA', contact: 'Roberto Fonseca', email: 'roberto@petroenergy.com.br', phone: '71977665544', value: 470000 },
      ];

      // Inbound leads data (20 leads)
      const inboundLeads = [
        { title: 'Landing Page Download Ebook', company: 'Startup Fintech X', contact: 'Mariana Alves', email: 'mariana@fintechx.com.br', phone: '11998877665', value: 25000 },
        { title: 'Webinar Gestão Ágil', company: 'Consultoria Ágil Pro', contact: 'Bruno Teixeira', email: 'bruno@agilpro.com.br', phone: '21987654321', value: 45000 },
        { title: 'Trial Plataforma SaaS', company: 'DataFlow Analytics', contact: 'Rafaela Cunha', email: 'rafaela@dataflow.com.br', phone: '11977665544', value: 80000 },
        { title: 'Formulário Contato Site', company: 'Padaria Pão Quente', contact: 'Antônio Borges', email: 'antonio@paoquente.com.br', phone: '31988776655', value: 15000 },
        { title: 'LinkedIn Ads Campanha Q1', company: 'Tech Solutions SP', contact: 'Gabriela Santos', email: 'gabriela@techsolutions.com.br', phone: '11966554433', value: 120000 },
        { title: 'Google Ads CRM Keywords', company: 'Varejo Digital ME', contact: 'Pedro Henrique', email: 'pedro@varejodigital.com.br', phone: '47991234567', value: 35000 },
        { title: 'Indicação Cliente Ativo', company: 'Transportes Rápido', contact: 'Cláudia Moraes', email: 'claudia@transrapido.com.br', phone: '41977665544', value: 95000 },
        { title: 'Blog Post Conversão', company: 'E-commerce Verde', contact: 'Fernando Dias', email: 'fernando@ecoverde.com.br', phone: '51988776655', value: 55000 },
        { title: 'Newsletter Signup Premium', company: 'Academia FitLife', contact: 'Larissa Rocha', email: 'larissa@fitlife.com.br', phone: '21966554433', value: 30000 },
        { title: 'Demo Request API Integration', company: 'SoftwareLab Sistemas', contact: 'Rodrigo Machado', email: 'rodrigo@softwarelab.com.br', phone: '11955443322', value: 180000 },
        { title: 'Case Study Download ERP', company: 'Indústria Nova Era', contact: 'Aline Barros', email: 'aline@novaera.ind.br', phone: '19988776655', value: 70000 },
        { title: 'Evento Presencial SP Tech', company: 'Agência Criativa Hub', contact: 'Diego Fernandes', email: 'diego@criativahub.com.br', phone: '11944332211', value: 40000 },
        { title: 'Chatbot Qualificação Automática', company: 'HealthTech Brasil', contact: 'Natália Pinto', email: 'natalia@healthtechbr.com.br', phone: '31977665544', value: 150000 },
        { title: 'SEO Orgânico Blog', company: 'Escritório Contábil Fácil', contact: 'Márcio Oliveira', email: 'marcio@contabilfacil.com.br', phone: '62991234567', value: 20000 },
        { title: 'Parceria Co-Marketing', company: 'EdTech Aprender', contact: 'Viviane Castro', email: 'viviane@edtechaprender.com.br', phone: '81988776655', value: 65000 },
        { title: 'Teste Gratuito 14 Dias', company: 'Logística Express ME', contact: 'Henrique Lima', email: 'henrique@logexpress.com.br', phone: '71966554433', value: 50000 },
        { title: 'Campanha Email Nurturing', company: 'Clínica Bem Estar', contact: 'Renata Souza', email: 'renata@bemestar.med.br', phone: '11933221100', value: 85000 },
        { title: 'Podcast Menção Espontânea', company: 'Studio Criativo Design', contact: 'Otávio Pereira', email: 'otavio@studiocriativo.com.br', phone: '21955443322', value: 30000 },
        { title: 'Instagram Lead Form', company: 'Moda Urbana Shop', contact: 'Carla Mendonça', email: 'carla@modaurbana.com.br', phone: '11977889900', value: 18000 },
        { title: 'Referral Program Tier 1', company: 'Consultoria RH Plus', contact: 'Wagner Costa', email: 'wagner@rhplus.com.br', phone: '41955667788', value: 110000 },
      ];

      // Create B2B leads (30)
      for (let i = 0; i < b2bLeads.length; i++) {
        const lead = b2bLeads[i];
        const statusIndex = i % (vendasB2B.statuses.length - 2); // exclude Ganho/Perdido for most
        const status = i >= 26
          ? vendasB2B.statuses[6] // last 4 as "Ganho"
          : vendasB2B.statuses[statusIndex];
        const assignee = assignees[i % 3];

        const company = await prisma.company.create({
          data: {
            organizationId: org.id,
            name: lead.company,
          },
        });

        const contact = await prisma.contact.create({
          data: {
            organizationId: org.id,
            name: lead.contact,
            email: lead.email,
            phone: lead.phone,
            companyId: company.id,
          },
        });

        await prisma.lead.create({
          data: {
            organizationId: org.id,
            pipelineId: vendasB2B.id,
            statusId: status.id,
            title: lead.title,
            estimatedValue: lead.value,
            priority: priorities[i % 4],
            temperature: temperatures[i % 3],
            assigneeId: assignee,
            contactId: contact.id,
            companyId: company.id,
            position: i,
            ...(i >= 26 ? { wonAt: new Date() } : {}),
          },
        });
      }

      // Create Inbound leads (20)
      for (let i = 0; i < inboundLeads.length; i++) {
        const lead = inboundLeads[i];
        const statusIndex = i % (inboundMkt.statuses.length - 2); // exclude Cliente/Descartado for most
        const status = i >= 17
          ? inboundMkt.statuses[4] // last 3 as "Cliente"
          : inboundMkt.statuses[statusIndex];
        const assignee = assignees[i % 3];

        const company = await prisma.company.create({
          data: {
            organizationId: org.id,
            name: lead.company,
          },
        });

        const contact = await prisma.contact.create({
          data: {
            organizationId: org.id,
            name: lead.contact,
            email: lead.email,
            phone: lead.phone,
            companyId: company.id,
          },
        });

        await prisma.lead.create({
          data: {
            organizationId: org.id,
            pipelineId: inboundMkt.id,
            statusId: status.id,
            title: lead.title,
            estimatedValue: lead.value,
            priority: priorities[i % 4],
            temperature: temperatures[i % 3],
            assigneeId: assignee,
            contactId: contact.id,
            companyId: company.id,
            position: i,
            ...(i >= 17 ? { wonAt: new Date() } : {}),
          },
        });
      }

      console.log('  Leads: 30 in Vendas B2B, 20 in Inbound Marketing');
    }
  }

  console.log('Seed completed:');
  console.log(`  Organization: ${org.name} (${org.slug})`);
  console.log(`  Users: ${admin.email} (OWNER), ${member1.email} (MEMBER), ${member2.email} (MEMBER)`);
  console.log('  Password for all: 123456');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
