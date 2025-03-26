import { prisma } from "@/config/database";
import { logger } from "@/shared/utils/logger.utils";
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/shared/errors/AppError";
import { TokenService } from "./token.service";
import { UserService } from "./user.service";
import { AuditService, AuditAction } from "@/shared/services/audit.service";
import {
  LoginRequestDto,
  LoginResponseDto,
  RefreshTokenRequestDto,
  RefreshTokenResponseDto,
  RegisterRequestDto,
  RegisterResponseDto,
  ChangePasswordRequestDto,
  SuccessResponseDto,
} from "../dto/auth.dto";

/**
 * Serviço principal de autenticação
 * Orquestra os outros serviços para operações de autenticação
 */
export class AuthService {
  private tokenService: TokenService;
  private userService: UserService;

  constructor() {
    this.tokenService = new TokenService();
    this.userService = new UserService();
  }

  /**
   * Autentica um usuário e retorna tokens de acesso e refresh
   */
  public async login(data: LoginRequestDto): Promise<LoginResponseDto> {
    try {
      logger.info(`Tentativa de login para o usuário: ${data.email}`);

      // Busca o usuário pelo email
      const user = await this.userService.findByEmail(data.email);

      // Verifica se o usuário existe
      if (!user) {
        logger.warn(
          `Falha no login: usuário não encontrado para ${data.email}`
        );
        AuditService.log(
          "login_failed",
          "authentication",
          undefined,
          undefined,
          { email: data.email, reason: "user_not_found" }
        );
        throw new UnauthorizedError("Credenciais inválidas");
      }

      // Verifica a senha
      const isPasswordValid = await this.userService.validatePassword(
        data.password,
        user.password
      );

      if (!isPasswordValid) {
        logger.warn(`Falha no login: senha incorreta para ${user.email}`);
        AuditService.log("login_failed", "authentication", undefined, user.id, {
          reason: "invalid_password",
        });
        throw new UnauthorizedError("Credenciais inválidas");
      }

      // Gera tokens
      const accessToken = await this.tokenService.generateAccessToken(
        user.id,
        user.email,
        user.role
      );
      const refreshToken = await this.tokenService.generateRefreshToken(
        user.id
      );

      // Atualiza o refresh token no banco
      await this.userService.updateRefreshToken(user.id, refreshToken);

      // Registra log de auditoria para login bem-sucedido
      AuditService.log(
        AuditAction.LOGIN,
        "authentication",
        undefined,
        user.id,
        { role: user.role }
      );
      logger.info(`Login bem-sucedido para ${user.email}`, {
        userId: user.id,
        role: user.role,
      });

      // Retorna os tokens e dados do usuário
      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      };
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) {
        logger.error(`Erro inesperado durante login para ${data.email}`, error);
      }
      throw error;
    }
  }

  /**
   * Registra um novo usuário
   */
  public async register(
    data: RegisterRequestDto
  ): Promise<RegisterResponseDto> {
    try {
      logger.info(`Tentativa de registro para o email: ${data.email}`);

      // Verifica se o email já está em uso
      await this.userService.validateUniqueEmail(data.email);

      // Verifica força da senha
      await this.userService.validatePasswordStrength(data.password);

      // Cria o usuário
      const user = await this.userService.createUser({
        name: data.name,
        email: data.email,
        password: data.password,
      });

      // Registra log de auditoria para registro bem-sucedido
      AuditService.log(AuditAction.REGISTER, "user", user.id, user.id, {
        name: user.name,
        email: user.email,
        role: user.role,
      });
      logger.info(`Usuário registrado com sucesso: ${user.email}`, {
        userId: user.id,
      });

      // Retorna os dados do usuário registrado
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      };
    } catch (error) {
      if (!(error instanceof ConflictError)) {
        logger.error(
          `Erro inesperado durante registro para ${data.email}`,
          error
        );
      }
      throw error;
    }
  }

  /**
   * Atualiza o token de acesso usando o token de refresh
   */
  public async refreshToken(
    data: RefreshTokenRequestDto
  ): Promise<RefreshTokenResponseDto> {
    try {
      logger.debug(`Tentativa de refresh de token`);

      // Verifica se o token é válido
      const tokenResult = await this.tokenService.verifyToken(
        data.refreshToken
      );

      if (!tokenResult.valid || !tokenResult.userId) {
        logger.warn(`Tentativa de refresh com token inválido ou expirado`);
        AuditService.log(
          "token_refresh_failed",
          "authentication",
          undefined,
          undefined,
          { reason: tokenResult.expired ? "expired_token" : "invalid_token" }
        );
        throw new UnauthorizedError("Token inválido ou expirado");
      }

      const userId = tokenResult.userId;

      // Busca o usuário
      const user = await this.userService.findById(userId);

      if (!user) {
        logger.warn(
          `Usuário não encontrado durante refresh de token: ${userId}`
        );
        AuditService.log(
          "token_refresh_failed",
          "authentication",
          undefined,
          userId,
          { reason: "user_not_found" }
        );
        throw new NotFoundError("Usuário");
      }

      // Verifica se o token corresponde ao armazenado no banco
      if (user.refreshToken !== data.refreshToken) {
        logger.warn(
          `Token de refresh não corresponde ao armazenado para usuário ${userId}`
        );
        AuditService.log(
          "token_refresh_failed",
          "authentication",
          undefined,
          userId,
          { reason: "token_mismatch" }
        );
        throw new UnauthorizedError("Token inválido");
      }

      // Gera novos tokens
      const accessToken = await this.tokenService.generateAccessToken(
        user.id,
        user.email,
        user.role
      );
      const refreshToken = await this.tokenService.generateRefreshToken(
        user.id
      );

      // Atualiza o refresh token no banco
      await this.userService.updateRefreshToken(user.id, refreshToken);

      // Adiciona o token antigo à blacklist
      await this.tokenService.blacklistToken(data.refreshToken);

      // Registra log de auditoria
      AuditService.log(
        AuditAction.TOKEN_REFRESH,
        "authentication",
        undefined,
        userId,
        { role: user.role }
      );
      logger.info(`Token atualizado com sucesso para usuário ${userId}`);

      // Retorna os novos tokens
      return {
        accessToken,
        refreshToken,
      };
    } catch (error) {
      if (
        !(error instanceof UnauthorizedError) &&
        !(error instanceof NotFoundError)
      ) {
        logger.error(`Erro inesperado durante refresh de token`, error);
      }
      throw error;
    }
  }

  /**
   * Realiza o logout do usuário
   */
  public async logout(
    userId: string,
    refreshToken: string
  ): Promise<SuccessResponseDto> {
    try {
      logger.info(`Iniciando logout para usuário ID: ${userId}`);

      // Adiciona o token à blacklist
      await this.tokenService.blacklistToken(refreshToken);

      // Remove o refresh token do usuário
      await this.userService.updateRefreshToken(userId, null);

      // Registra log de auditoria
      AuditService.log(AuditAction.LOGOUT, "authentication", undefined, userId);
      logger.info(`Logout concluído com sucesso para usuário ${userId}`);

      return {
        success: true,
        message: "Logout realizado com sucesso",
      };
    } catch (error) {
      logger.error(`Erro durante logout para usuário ${userId}`, error);
      throw error;
    }
  }

  /**
   * Altera a senha do usuário
   */
  public async changePassword(
    userId: string,
    data: ChangePasswordRequestDto
  ): Promise<SuccessResponseDto> {
    try {
      logger.info(`Tentativa de alteração de senha para usuário ID: ${userId}`);

      // Busca o usuário
      const user = await this.userService.findById(userId);

      if (!user) {
        logger.warn(
          `Usuário não encontrado durante alteração de senha: ${userId}`
        );
        AuditService.log("password_change_failed", "user", userId, userId, {
          reason: "user_not_found",
        });
        throw new NotFoundError("Usuário");
      }

      // Verifica se a senha atual está correta
      const isPasswordValid = await this.userService.validatePassword(
        data.currentPassword,
        user.password
      );

      if (!isPasswordValid) {
        logger.warn(
          `Senha atual incorreta durante alteração de senha para usuário ${userId}`
        );
        AuditService.log("password_change_failed", "user", userId, userId, {
          reason: "incorrect_current_password",
        });
        throw new UnauthorizedError("Senha atual incorreta");
      }

      // Verifica se a nova senha é forte o suficiente
      await this.userService.validatePasswordStrength(data.newPassword);

      // Garante que a nova senha é diferente da atual
      if (data.currentPassword === data.newPassword) {
        logger.warn(
          `Nova senha igual à atual durante alteração para usuário ${userId}`
        );
        AuditService.log("password_change_failed", "user", userId, userId, {
          reason: "same_password",
        });
        throw new ValidationError("Nova senha deve ser diferente da atual");
      }

      // Atualiza a senha
      await this.userService.updatePassword(userId, data.newPassword);

      // Invalida tokens de refresh
      if (user.refreshToken) {
        await this.tokenService.blacklistToken(user.refreshToken);
        await this.userService.updateRefreshToken(userId, null);
      }

      // Registra log de auditoria
      AuditService.log(AuditAction.PASSWORD_CHANGE, "user", userId, userId);
      logger.info(`Senha alterada com sucesso para usuário ${userId}`);

      return {
        success: true,
        message: "Senha alterada com sucesso",
      };
    } catch (error) {
      if (
        !(error instanceof UnauthorizedError) &&
        !(error instanceof NotFoundError) &&
        !(error instanceof ValidationError)
      ) {
        logger.error(
          `Erro inesperado durante alteração de senha para usuário ${userId}`,
          error
        );
      }
      throw error;
    }
  }
}
