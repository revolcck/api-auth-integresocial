import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { ApiResponse } from "@/shared/utils/api-response.utils";

/**
 * Controlador que implementa os endpoints de autenticação
 */
export class AuthController {
  /**
   * Instância do serviço de autenticação
   */
  private authService: AuthService;

  /**
   * Inicializa o controlador com uma instância do serviço de autenticação
   */
  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Realiza login do usuário
   * @route POST /api/auth/login
   */
  public login = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.authService.login(req.body);

      ApiResponse.success(res, result, {
        message: "Login realizado com sucesso",
        statusCode: 200,
      });
    } catch (error) {
      // Erro será tratado pelo middleware global de erros
      throw error;
    }
  };

  /**
   * Registra um novo usuário
   * @route POST /api/auth/register
   */
  public register = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.authService.register(req.body);

      ApiResponse.success(res, result, {
        message: "Usuário registrado com sucesso",
        statusCode: 201,
      });
    } catch (error) {
      throw error;
    }
  };

  /**
   * Atualiza o token de acesso usando o token de refresh
   * @route POST /api/auth/refresh
   */
  public refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.authService.refreshToken(req.body);

      ApiResponse.success(res, result, {
        message: "Token atualizado com sucesso",
      });
    } catch (error) {
      throw error;
    }
  };

  /**
   * Realiza o logout do usuário
   * @route POST /api/auth/logout
   */
  public logout = async (req: Request, res: Response): Promise<void> => {
    try {
      // Usuário já foi validado pelo middleware authenticate
      const userId = req.user!.id;
      const { refreshToken } = req.body;

      const result = await this.authService.logout(userId, refreshToken);

      ApiResponse.success(res, result);
    } catch (error) {
      throw error;
    }
  };

  /**
   * Altera a senha do usuário
   * @route POST /api/auth/change-password
   */
  public changePassword = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      // Usuário já foi validado pelo middleware authenticate
      const userId = req.user!.id;
      const result = await this.authService.changePassword(userId, req.body);

      ApiResponse.success(res, result);
    } catch (error) {
      throw error;
    }
  };
}
