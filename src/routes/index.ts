import { Router } from "express";
import authRoutes from "@/modules/auth/routes/auth.routes";

const router: Router = Router();

/**
 * Configura as rotas de cada módulo com seus prefixos correspondentes
 */

// Rotas de autenticação
router.use("/auth", authRoutes);

export default router;
