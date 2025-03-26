/**
 * DTOs (Data Transfer Objects) para o módulo de autenticação
 * Define a estrutura dos dados para as operações de autenticação
 */

/**
 * DTO para requisição de login
 */
export interface LoginRequestDto {
  email: string;
  password: string;
}

/**
 * DTO para resposta de login
 */
export interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

/**
 * DTO para requisição de refresh token
 */
export interface RefreshTokenRequestDto {
  refreshToken: string;
}

/**
 * DTO para resposta de refresh token
 */
export interface RefreshTokenResponseDto {
  accessToken: string;
  refreshToken: string;
}

/**
 * DTO para requisição de registro de usuário
 */
export interface RegisterRequestDto {
  name: string;
  email: string;
  password: string;
}

/**
 * DTO para resposta de registro de usuário
 */
export interface RegisterResponseDto {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}

/**
 * DTO para requisição de alteração de senha
 */
export interface ChangePasswordRequestDto {
  currentPassword: string;
  newPassword: string;
}

/**
 * DTO para resposta genérica de sucesso
 */
export interface SuccessResponseDto {
  success: boolean;
  message: string;
}
