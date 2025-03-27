import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTenantDto,
  UpdateTenantDto,
  TenantResponseDto,
  AddUserToTenantDto,
} from './dto';
import { Tenant, TenantStatus } from '@prisma/client';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Mapear tenant para DTO de resposta
  private mapTenantToDto(
    tenant: Tenant & {
      plan?: {
        id: string;
        name: string;
        maxProjects: number;
        maxUsers: number;
        maxBeneficiaries: number;
        availableModules: any;
      };
    },
  ): TenantResponseDto {
    const result: TenantResponseDto = {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      status: tenant.status,
      planId: tenant.planId,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };

    if (tenant.plan) {
      result.plan = {
        id: tenant.plan.id,
        name: tenant.plan.name,
        maxProjects: tenant.plan.maxProjects,
        maxUsers: tenant.plan.maxUsers,
        maxBeneficiaries: tenant.plan.maxBeneficiaries,
        availableModules: tenant.plan.availableModules as Record<
          string,
          boolean
        >,
      };
    }

    return result;
  }

  // Criar um novo tenant
  async create(createTenantDto: CreateTenantDto): Promise<TenantResponseDto> {
    const { name, subdomain, planId } = createTenantDto;

    // Verificar se subdomínio já existe
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { subdomain },
    });

    if (existingTenant) {
      throw new ConflictException(`O subdomínio '${subdomain}' já está em uso`);
    }

    // Verificar se o plano existe
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException(`Plano com ID ${planId} não encontrado`);
    }

    try {
      // Criar tenant no banco de dados
      const newTenant = await this.prisma.tenant.create({
        data: {
          name,
          subdomain,
          planId,
          status: TenantStatus.ACTIVE,
        },
        include: {
          plan: true,
        },
      });

      this.logger.log(`Tenant criado com sucesso: ${newTenant.id}`);
      return this.mapTenantToDto(newTenant);
    } catch (error) {
      this.logger.error(`Erro ao criar tenant: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Buscar todos os tenants
  async findAll(): Promise<TenantResponseDto[]> {
    const tenants = await this.prisma.tenant.findMany({
      include: {
        plan: true,
      },
    });

    return tenants.map((tenant) => this.mapTenantToDto(tenant));
  }

  // Buscar tenant por ID
  async findById(id: string): Promise<TenantResponseDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        plan: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant com ID ${id} não encontrado`);
    }

    return this.mapTenantToDto(tenant);
  }

  // Buscar tenant por subdomínio
  async findBySubdomain(subdomain: string): Promise<TenantResponseDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain },
      include: {
        plan: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException(
        `Tenant com subdomínio ${subdomain} não encontrado`,
      );
    }

    return this.mapTenantToDto(tenant);
  }

  // Atualizar tenant
  async update(
    id: string,
    updateTenantDto: UpdateTenantDto,
  ): Promise<TenantResponseDto> {
    // Verificar se tenant existe
    await this.findById(id);

    // Se subdomínio está sendo atualizado, verificar se já está em uso
    if (updateTenantDto.subdomain) {
      const existingTenant = await this.prisma.tenant.findFirst({
        where: {
          subdomain: updateTenantDto.subdomain,
          id: { not: id },
        },
      });

      if (existingTenant) {
        throw new ConflictException(
          `O subdomínio '${updateTenantDto.subdomain}' já está em uso`,
        );
      }
    }

    // Se planId está sendo atualizado, verificar se o plano existe
    if (updateTenantDto.planId) {
      const plan = await this.prisma.plan.findUnique({
        where: { id: updateTenantDto.planId },
      });

      if (!plan) {
        throw new NotFoundException(
          `Plano com ID ${updateTenantDto.planId} não encontrado`,
        );
      }
    }

    try {
      const updatedTenant = await this.prisma.tenant.update({
        where: { id },
        data: updateTenantDto,
        include: {
          plan: true,
        },
      });

      this.logger.log(`Tenant atualizado com sucesso: ${id}`);
      return this.mapTenantToDto(updatedTenant);
    } catch (error) {
      this.logger.error(
        `Erro ao atualizar tenant: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Remover tenant
  async remove(id: string): Promise<void> {
    // Verificar se tenant existe
    await this.findById(id);

    try {
      // Em vez de excluir, marcar como inativo
      await this.prisma.tenant.update({
        where: { id },
        data: { status: TenantStatus.INACTIVE },
      });

      this.logger.log(`Tenant marcado como inativo: ${id}`);
    } catch (error) {
      this.logger.error(
        `Erro ao remover tenant: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Adicionar usuário ao tenant
  async addUser(
    tenantId: string,
    addUserDto: AddUserToTenantDto,
  ): Promise<void> {
    const { userId, roleId } = addUserDto;

    // Verificar se tenant existe
    await this.findById(tenantId);

    // Verificar se usuário existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`Usuário com ID ${userId} não encontrado`);
    }

    // Verificar se o papel existe
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException(`Papel com ID ${roleId} não encontrado`);
    }

    // Verificar se o usuário já está associado ao tenant
    const existingUserTenant = await this.prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
        },
      },
    });

    if (existingUserTenant) {
      throw new ConflictException(`Usuário já associado ao tenant`);
    }

    try {
      // Verificar limites do plano
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          plan: true,
          userTenants: true,
        },
      });

      if (tenant.userTenants.length >= tenant.plan.maxUsers) {
        throw new ForbiddenException(
          `Limite de usuários atingido para o plano ${tenant.plan.name}`,
        );
      }

      // Associar usuário ao tenant
      await this.prisma.userTenant.create({
        data: {
          userId,
          tenantId,
          roleId,
        },
      });

      this.logger.log(`Usuário ${userId} adicionado ao tenant ${tenantId}`);
    } catch (error) {
      this.logger.error(
        `Erro ao adicionar usuário ao tenant: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Remover usuário do tenant
  async removeUser(tenantId: string, userId: string): Promise<void> {
    // Verificar se a associação existe
    const userTenant = await this.prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
        },
      },
    });

    if (!userTenant) {
      throw new NotFoundException(`Usuário não associado ao tenant`);
    }

    try {
      // Remover associação
      await this.prisma.userTenant.delete({
        where: {
          userId_tenantId: {
            userId,
            tenantId,
          },
        },
      });

      this.logger.log(`Usuário ${userId} removido do tenant ${tenantId}`);
    } catch (error) {
      this.logger.error(
        `Erro ao remover usuário do tenant: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Listar usuários do tenant
  async listUsers(tenantId: string): Promise<any[]> {
    // Verificar se tenant existe
    await this.findById(tenantId);

    try {
      const userTenants = await this.prisma.userTenant.findMany({
        where: { tenantId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
              lastLogin: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
      });

      return userTenants.map((ut) => ({
        ...ut.user,
        role: ut.role,
      }));
    } catch (error) {
      this.logger.error(
        `Erro ao listar usuários do tenant: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
