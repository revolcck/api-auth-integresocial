import { PrismaClient, UserStatus, TenantStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Criar papéis (roles) iniciais
  console.log('📊 Criando papéis iniciais...');

  const adminRole = await prisma.role.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Administrador',
      description: 'Acesso completo ao sistema',
      isSystemRole: true,
      permissions: {
        users: {
          read: true,
          create: true,
          update: true,
          delete: true,
        },
        tenants: {
          read: true,
          create: true,
          update: true,
          delete: true,
        },
        projects: {
          read: true,
          create: true,
          update: true,
          delete: true,
        },
      },
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Gerente',
      description: 'Acesso gerencial ao sistema',
      isSystemRole: true,
      permissions: {
        users: {
          read: true,
          create: true,
          update: true,
          delete: false,
        },
        tenants: {
          read: true,
          create: false,
          update: false,
          delete: false,
        },
        projects: {
          read: true,
          create: true,
          update: true,
          delete: true,
        },
      },
    },
  });

  const operatorRole = await prisma.role.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Operador',
      description: 'Acesso operacional ao sistema',
      isSystemRole: true,
      permissions: {
        users: {
          read: true,
          create: false,
          update: false,
          delete: false,
        },
        tenants: {
          read: true,
          create: false,
          update: false,
          delete: false,
        },
        projects: {
          read: true,
          create: false,
          update: true,
          delete: false,
        },
      },
    },
  });

  const viewerRole = await prisma.role.upsert({
    where: { id: '00000000-0000-0000-0000-000000000004' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000004',
      name: 'Visualizador',
      description: 'Acesso somente leitura ao sistema',
      isSystemRole: true,
      permissions: {
        users: {
          read: true,
          create: false,
          update: false,
          delete: false,
        },
        tenants: {
          read: true,
          create: false,
          update: false,
          delete: false,
        },
        projects: {
          read: true,
          create: false,
          update: false,
          delete: false,
        },
      },
    },
  });

  console.log(
    `✅ Papéis criados: ${adminRole.name}, ${managerRole.name}, ${operatorRole.name}, ${viewerRole.name}`,
  );

  // Criar planos iniciais
  console.log('💰 Criando planos iniciais...');

  const basicPlan = await prisma.plan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Start',
      maxProjects: 2,
      maxUsers: 5,
      maxBeneficiaries: 5000,
      availableModules: {
        Atendimento: true,
        Cadastro: true,
        Financeiro: false,
        Saude: false,
        Marketing: false,
      },
      price: 497,
    },
  });

  const proPlan = await prisma.plan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Intermediário',
      maxProjects: 6,
      maxUsers: 15,
      maxBeneficiaries: 10000,
      availableModules: {
        Atendimento: true,
        Cadastro: true,
        Financeiro: true,
        Saude: true,
        Marketing: false,
      },
      price: 997,
    },
  });

  const advancedPlan = await prisma.plan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Avançado',
      maxProjects: 10,
      maxUsers: 30,
      maxBeneficiaries: 20000,
      availableModules: {
        Atendimento: true,
        Cadastro: true,
        Financeiro: true,
        Saude: true,
        Marketing: true,
      },
      price: 1997,
    },
  });

  console.log(
    `✅ Planos criados: ${basicPlan.name}, ${proPlan.name}, ${advancedPlan.name}`,
  );

  // Criar usuário administrador
  console.log('👤 Criando usuário administrador...');

  const passwordHash = await argon2.hash('Admin@123', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@integresocial.cloud' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@integresocial.cloud',
      firstName: 'Administrador',
      lastName: 'Sistema',
      passwordHash,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(`✅ Usuário administrador criado: ${adminUser.email}`);

  // Criar tenant de demonstração
  console.log('🏢 Criando tenant de demonstração...');

  const demoTenant = await prisma.tenant.upsert({
    where: { subdomain: 'demo' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Demonstração',
      subdomain: 'demo',
      planId: advancedPlan.id,
      status: TenantStatus.ACTIVE,
    },
  });

  console.log(`✅ Tenant de demonstração criado: ${demoTenant.name}`);

  // Associar admin ao tenant demo
  console.log('🔗 Associando usuário administrador ao tenant demo...');

  const userTenant = await prisma.userTenant.upsert({
    where: {
      userId_tenantId: {
        userId: adminUser.id,
        tenantId: demoTenant.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      tenantId: demoTenant.id,
      roleId: adminRole.id,
    },
  });

  console.log(
    `✅ Usuário ${adminUser.email} associado ao tenant ${demoTenant.name} com papel ${adminRole.name}`,
  );

  console.log('✅ Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro durante o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
