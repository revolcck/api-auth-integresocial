/**
 * Interface para parâmetros de paginação
 */
export interface PaginationParams {
  page?: number; // Número da página (começando em 1)
  limit?: number; // Número de itens por página
  sortBy?: string; // Campo para ordenação
  sortOrder?: "asc" | "desc"; // Direção da ordenação
}

/**
 * Interface para metadados de paginação
 */
export interface PaginationMeta {
  currentPage: number; // Página atual
  itemsPerPage: number; // Itens por página
  totalItems: number; // Total de itens disponíveis
  totalPages: number; // Total de páginas
  hasNextPage: boolean; // Se existe próxima página
  hasPrevPage: boolean; // Se existe página anterior
}

/**
 * Interface para resposta paginada
 */
export interface PaginatedResponse<T> {
  data: T[]; // Lista de itens
  meta: PaginationMeta; // Metadados da paginação
}

/**
 * Classe de utilitários para paginação
 * Fornece métodos para processar parâmetros de paginação e formatar respostas paginadas
 */
export class PaginationUtils {
  /**
   * Valor padrão para itens por página
   */
  private static readonly DEFAULT_PAGE_SIZE = 10;

  /**
   * Valor máximo permitido para itens por página
   */
  private static readonly MAX_PAGE_SIZE = 100;

  /**
   * Valida e normaliza os parâmetros de paginação
   * @param params Parâmetros de paginação recebidos na requisição
   * @returns Parâmetros de paginação normalizados
   */
  public static normalizePaginationParams(params: PaginationParams): {
    page: number;
    limit: number;
    skip: number;
    sortBy?: string;
    sortOrder: "asc" | "desc";
  } {
    // Garante que page seja um número maior que zero, ou usa 1 como padrão
    const page = Math.max(1, Number(params.page) || 1);

    // Garante que limit seja um número entre 1 e MAX_PAGE_SIZE, ou usa DEFAULT_PAGE_SIZE
    const limit = Math.min(
      this.MAX_PAGE_SIZE,
      Math.max(1, Number(params.limit) || this.DEFAULT_PAGE_SIZE)
    );

    // Calcula o número de itens a serem pulados para a paginação
    const skip = (page - 1) * limit;

    // Configura a ordenação
    const sortBy = params.sortBy;
    const sortOrder =
      params.sortOrder?.toLowerCase() === "desc" ? "desc" : "asc";

    return {
      page,
      limit,
      skip,
      sortBy,
      sortOrder,
    };
  }

  /**
   * Cria um objeto de resposta paginada
   * @param data Lista de itens para a página atual
   * @param totalItems Total de itens disponíveis (em todas as páginas)
   * @param params Parâmetros de paginação normalizados
   * @returns Resposta paginada formatada
   */
  public static createPaginatedResponse<T>(
    data: T[],
    totalItems: number,
    params: { page: number; limit: number }
  ): PaginatedResponse<T> {
    const totalPages = Math.ceil(totalItems / params.limit);

    const meta: PaginationMeta = {
      currentPage: params.page,
      itemsPerPage: params.limit,
      totalItems,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPrevPage: params.page > 1,
    };

    return {
      data,
      meta,
    };
  }

  /**
   * Cria parâmetros de ordenação para o Prisma
   * @param sortBy Campo para ordenação
   * @param sortOrder Direção da ordenação
   * @returns Objeto de ordenação para o Prisma
   */
  public static createPrismaSortObject(
    sortBy?: string,
    sortOrder: "asc" | "desc" = "asc"
  ): Record<string, string> | undefined {
    if (!sortBy) {
      return undefined;
    }

    return {
      [sortBy]: sortOrder,
    };
  }
}
