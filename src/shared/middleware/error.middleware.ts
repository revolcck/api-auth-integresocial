import { Request, Response, NextFunction } from "express";
import { ErrorHandler } from "@/shared/errors/ErrorHandler";

/**
 * Middleware que captura todos os erros da aplicação e os repassa para o ErrorHandler
 * @param err Erro capturado
 * @param req Objeto de requisição
 * @param res Objeto de resposta
 * @param next Próximo middleware
 */
export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  ErrorHandler.handle(err, req, res, next);
};
