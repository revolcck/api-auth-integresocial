import { prisma } from "@/config/database";
import { HashUtils } from "@/shared/utils/hash.utils";
import { ConflictError, ValidationError } from "@/shared/errors/AppError";
import { logger } from "@/shared/utils/logger.utils";
import { Role } from "@prisma/client";

interface CreateUserParams {
  name: string;
  email: string;
  password: string;
  role?: Role; // Usar o enum Role importado do Prisma
}

/**
 * Serviço para gerenciamento de usuários
 */
export class UserService {
  /**
   * Busca um usuário pelo email
   */
  public async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Busca um usuário pelo ID
   */
  public async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Verifica se um email já está em uso
   */
  public async validateUniqueEmail(email: string): Promise<void> {
    const existingUser = await this.findByEmail(email);

    if (existingUser) {
      logger.warn(`Email já está em uso: ${email}`);
      throw new ConflictError("Email já está em uso");
    }
  }

  /**
   * Valida a força da senha
   */
  public async validatePasswordStrength(password: string): Promise<void> {
    if (!HashUtils.isStrongPassword(password)) {
      logger.warn(`Senha não atende aos requisitos de segurança`);
      throw new ValidationError("Senha não atende aos requisitos de segurança");
    }
  }

  /**
   * Valida se a senha fornecida corresponde ao hash
   */
  public async validatePassword(
    password: string,
    hash: string
  ): Promise<boolean> {
    return HashUtils.compare(password, hash);
  }

  /**
   * Cria um novo usuário
   */
  public async createUser(data: CreateUserParams) {
    const hashedPassword = await HashUtils.hash(data.password);

    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role || Role.USER, // Usar o enum Role.USER
      },
    });
  }

  /**
   * Atualiza o refresh token de um usuário
   */
  public async updateRefreshToken(
    userId: string,
    refreshToken: string | null
  ): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken },
    });

    logger.debug(
      `Refresh token ${
        refreshToken ? "atualizado" : "removido"
      } para usuário ${userId}`
    );
  }

  /**
   * Atualiza a senha de um usuário
   */
  public async updatePassword(
    userId: string,
    newPassword: string
  ): Promise<void> {
    const hashedPassword = await HashUtils.hash(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    logger.debug(`Senha atualizada para usuário ${userId}`);
  }
}
