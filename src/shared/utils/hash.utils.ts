import bcryptjs from "bcryptjs";

/**
 * Classe para manipulação de hashes de senha
 * Encapsula a lógica de geração e verificação de senhas hasheadas
 */
export class HashUtils {
  /**
   * Número de rounds para o bcryptjs
   * Valores mais altos são mais seguros, mas mais lentos
   * 12 é um bom equilíbrio entre segurança e performance
   */
  private static readonly SALT_ROUNDS = 12;

  /**
   * Gera um hash para uma senha
   * @param password Senha em texto puro
   * @returns Senha hasheada
   */
  public static async hash(password: string): Promise<string> {
    return bcryptjs.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Verifica se uma senha em texto puro corresponde a um hash
   * @param password Senha em texto puro
   * @param hash Hash a ser comparado
   * @returns Verdadeiro se a senha corresponder ao hash
   */
  public static async compare(
    password: string,
    hash: string
  ): Promise<boolean> {
    return bcryptjs.compare(password, hash);
  }

  /**
   * Verifica se uma senha atende aos requisitos mínimos de segurança
   * @param password Senha a ser verificada
   * @returns Verdadeiro se a senha for considerada forte
   */
  public static isStrongPassword(password: string): boolean {
    // Mínimo de 8 caracteres
    if (password.length < 8) {
      return false;
    }

    // Verifica se a senha contém pelo menos:
    // - Uma letra maiúscula
    // - Uma letra minúscula
    // - Um número
    // - Um caractere especial
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
      password
    );

    return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChars;
  }

  /**
   * Gera uma senha aleatória que atende aos requisitos mínimos de segurança
   * @param length Comprimento da senha (mínimo 8, padrão 12)
   * @returns Senha gerada aleatoriamente
   */
  public static generateRandomPassword(length = 12): string {
    if (length < 8) {
      length = 8; // Força um comprimento mínimo de 8 caracteres
    }

    const upperCase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowerCase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const specialChars = "!@#$%^&*()_+-=[]{}|;:,.<>?";
    const allChars = upperCase + lowerCase + numbers + specialChars;

    // Garante que a senha terá pelo menos um caracter de cada tipo
    let password = "";
    password += upperCase.charAt(Math.floor(Math.random() * upperCase.length));
    password += lowerCase.charAt(Math.floor(Math.random() * lowerCase.length));
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
    password += specialChars.charAt(
      Math.floor(Math.random() * specialChars.length)
    );

    // Completa o restante da senha com caracteres aleatórios
    for (let i = password.length; i < length; i++) {
      password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }

    // Embaralha os caracteres para evitar um padrão previsível
    return password
      .split("")
      .sort(() => 0.5 - Math.random())
      .join("");
  }
}
