import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('@Mag8968', 12);

  const org = await prisma.organization.upsert({
    where: { slug: 'agencia-swift' },
    update: { name: 'Agência Swift' },
    create: {
      name: 'Agência Swift',
      slug: 'agencia-swift',
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'bobktt777@gmail.com' },
    update: { name: 'Marcos Lourenço', passwordHash },
    create: {
      name: 'Marcos Lourenço',
      email: 'bobktt777@gmail.com',
      passwordHash,
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: admin.id,
        organizationId: org.id,
      },
    },
    update: { role: 'OWNER' },
    create: {
      userId: admin.id,
      organizationId: org.id,
      role: 'OWNER',
    },
  });

  const vendasB2B = await prisma.pipeline.findFirst({
    where: { organizationId: org.id, name: 'Vendas B2B' },
  });

  if (!vendasB2B) {
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
  }

  const inboundMkt = await prisma.pipeline.findFirst({
    where: { organizationId: org.id, name: 'Inbound Marketing' },
  });

  if (!inboundMkt) {
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
  }

  console.log('Seed completed:');
  console.log(`  Organization: ${org.name} (${org.slug})`);
  console.log(`  Admin: ${admin.email} (OWNER)`);
  console.log('  Pipelines: Vendas B2B (8 statuses), Inbound Marketing (6 statuses)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
