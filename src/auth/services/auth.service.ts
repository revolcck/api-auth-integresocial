import {
  Injectable,
  UnauthorizedException,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  LoginDto,
  LoginResponseDto,
  SelectTenantDto,
  SelectTenantResponseDto,
} from './dto';
import { createTenantJwtConfig } from '../config/jwt.config';
import { UserStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  // Validar credenciais de usuário
  async validateUser(email: string, password: string): Promise<any> {
    try {
      // Buscar usuário pelo email
      const user = await this.usersService.findByEmail(email);

      // Verificar se o usuário está ativo
      if (user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException(
          'Conta de usuário inativa ou bloqueada',
        );
      }

      // Verificar senha
      const isPasswordValid = await this.usersService.verifyPassword(
        user,
        password,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException('Credenciais inválidas');
      }

      // Retornar usuário sem a senha
      const { passwordHash, ...result } = user;
      return result;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException('Credenciais inválidas');
      }
      throw error;
    }
  }

  // Login do usuário
  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    // Validar credenciais
    const user = await this.validateUser(loginDto.email, loginDto.password);

    // Buscar tenants do usuário
    const userTenants = await this.prisma.userTenant.findMany({
      where: { userId: user.id },
      include: {
        tenant: true,
        role: {
          select: {
            name: true,
          },
        },
      },
    });

    // Verificar se o usuário tem acesso a pelo menos um tenant
    if (userTenants.length === 0) {
      throw new ForbiddenException('Usuário não possui acesso a nenhum tenant');
    }

    // Gerar tokens
    const tokens = await this.generateTokens(user.id);

    // Atualizar última data de login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Registrar sessão
    await this.createSession(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      tenants: userTenants.map((ut) => ({
        id: ut.tenant.id,
        name: ut.tenant.name,
        subdomain: ut.tenant.subdomain,
        role: ut.role.name,
      })),
    };
  }

  // Selecionar tenant após login
  async selectTenant(
    userId: string,
    selectTenantDto: SelectTenantDto,
  ): Promise<SelectTenantResponseDto> {
    const { tenantId } = selectTenantDto;

    // Verificar se o usuário tem acesso ao tenant
    const userTenant = await this.prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
        },
      },
      include: {
        tenant: true,
      },
    });

    if (!userTenant) {
      throw new ForbiddenException(
        'Usuário não possui acesso ao tenant selecionado',
      );
    }

    // Verificar se o tenant está ativo
    if (userTenant.tenant.status !== 'ACTIVE') {
      throw new ForbiddenException('O tenant selecionado está inativo');
    }

    // Gerar token específico para o tenant
    const tenantJwtConfig = createTenantJwtConfig(userTenant.tenant.subdomain);
    const payload = {
      sub: userId,
      tenantId,
      role: userTenant.roleId,
    };

    const accessToken = this.jwtService.sign(payload, tenantJwtConfig);

    // URL para redirecionamento
    const redirectUrl = `https://${userTenant.tenant.subdomain}.integresocial.cloud`;

    return {
      accessToken,
      tenant: {
        id: userTenant.tenant.id,
        name: userTenant.tenant.name,
        subdomain: userTenant.tenant.subdomain,
      },
      redirectUrl,
    };
  }

  // Gerar tokens de acesso e refresh
  private async generateTokens(userId: string) {
    const payload = { sub: userId };

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: await this.generateRefreshToken(),
    };
  }

  // Gerar token de refresh
  private async generateRefreshToken(): Promise<string> {
    return crypto.randomBytes(40).toString('hex');
  }

  // Criar sessão de usuário
  private async createSession(userId: string, refreshToken: string) {
    // Hash do refresh token para armazenamento seguro
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    // Calcular data de expiração com base na configuração
    const expiresAt = new Date();
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRATION || '7d';

    // Converter string como "7d" para milissegundos
    const ms = this.parseDuration(refreshExpiresIn);
    expiresAt.setTime(expiresAt.getTime() + ms);

    // Criar registro de sessão
    await this.prisma.userSession.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ipAddress: '127.0.0.1', // Em implementação real, pegar do request
        deviceInfo: 'API', // Em implementação real, pegar do User-Agent
      },
    });
  }

  // Método auxiliar para converter duração (1h, 7d, etc) em milissegundos
  private parseDuration(duration: string): number {
    const regex = /^(\d+)([smhdwy])$/;
    const match = regex.exec(duration);

    if (!match) {
      return 7 * 24 * 60 * 60 * 1000; // 7 dias por padrão
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers = {
      s: 1000, // segundos
      m: 60 * 1000, // minutos
      h: 60 * 60 * 1000, // horas
      d: 24 * 60 * 60 * 1000, // dias
      w: 7 * 24 * 60 * 60 * 1000, // semanas
      y: 365 * 24 * 60 * 60 * 1000, // anos
    };

    return value * multipliers[unit];
  }

  // Validar refresh token
  async refreshTokens(refreshToken: string): Promise<{ accessToken: string }> {
    // Hash do refresh token para comparação
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    // Buscar sessão pelo token
    const session = await this.prisma.userSession.findFirst({
      where: {
        tokenHash,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Sessão inválida ou expirada');
    }

    // Gerar novo token de acesso
    const payload = { sub: session.userId };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
  }

  // Encerrar sessão (logout)
  async logout(refreshToken: string): Promise<void> {
    // Hash do refresh token para comparação
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    // Remover sessão
    await this.prisma.userSession.deleteMany({
      where: {
        tokenHash,
      },
    });
  }
}
