import { z } from 'zod';

// Schema para criação de tenant
export const createTenantSchema = z.object({
  name: z.string().min(3, { message: 'Nome deve ter pelo menos 3 caracteres' }),
  subdomain: z
    .string()
    .min(3, { message: 'Subdomínio deve ter pelo menos 3 caracteres' })
    .max(50, { message: 'Subdomínio não pode ter mais de 50 caracteres' })
    .regex(/^[a-z0-9-]+$/, {
      message:
        'Subdomínio deve conter apenas letras minúsculas, números e hífens',
    }),
  planId: z.string().uuid({ message: 'ID de plano inválido' }),
});

// Tipo para criação de tenant
export type CreateTenantDto = z.infer<typeof createTenantSchema>;

// Schema para atualização de tenant
export const updateTenantSchema = createTenantSchema.partial().extend({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'INACTIVE', 'TRIAL']).optional(),
});

// Tipo para atualização de tenant
export type UpdateTenantDto = z.infer<typeof updateTenantSchema>;

// Schema para resposta de tenant
export const tenantResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  subdomain: z.string(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'INACTIVE', 'TRIAL']),
  planId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  plan: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      maxProjects: z.number(),
      maxUsers: z.number(),
      maxBeneficiaries: z.number(),
      availableModules: z.record(z.boolean()),
    })
    .optional(),
});

// Tipo para resposta de tenant
export type TenantResponseDto = z.infer<typeof tenantResponseSchema>;

// Schema para adição de usuário ao tenant
export const addUserToTenantSchema = z.object({
  userId: z.string().uuid({ message: 'ID de usuário inválido' }),
  roleId: z.string().uuid({ message: 'ID de papel inválido' }),
});

// Tipo para adição de usuário ao tenant
export type AddUserToTenantDto = z.infer<typeof addUserToTenantSchema>;
