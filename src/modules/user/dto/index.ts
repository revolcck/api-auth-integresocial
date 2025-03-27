import { z } from 'zod';

// Schema para criação de usuário
export const createUserSchema = z.object({
  email: z.string().email({ message: 'E-mail inválido' }),
  firstName: z
    .string()
    .min(2, { message: 'Nome deve ter pelo menos 2 caracteres' }),
  lastName: z
    .string()
    .min(2, { message: 'Sobrenome deve ter pelo menos 2 caracteres' }),
  password: z
    .string()
    .min(8, { message: 'Senha deve ter pelo menos 8 caracteres' })
    .regex(/[A-Z]/, {
      message: 'Senha deve conter pelo menos uma letra maiúscula',
    })
    .regex(/[a-z]/, {
      message: 'Senha deve conter pelo menos uma letra minúscula',
    })
    .regex(/[0-9]/, { message: 'Senha deve conter pelo menos um número' }),
});

// Tipo para criação de usuário
export type CreateUserDto = z.infer<typeof createUserSchema>;

// Schema para atualização de usuário
export const updateUserSchema = createUserSchema
  .partial()
  .omit({ password: true });

// Tipo para atualização de usuário
export type UpdateUserDto = z.infer<typeof updateUserSchema>;

// Schema para resposta de usuário
export const userResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']),
  lastLogin: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Tipo para resposta de usuário
export type UserResponseDto = z.infer<typeof userResponseSchema>;
