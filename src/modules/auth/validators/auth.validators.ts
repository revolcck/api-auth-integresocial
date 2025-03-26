import Joi from "joi";

/**
 * Schema para validação de login
 */
export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email deve ser um endereço de email válido",
    "string.empty": "Email é obrigatório",
    "any.required": "Email é obrigatório",
  }),

  password: Joi.string().min(8).required().messages({
    "string.min": "Senha deve ter no mínimo {#limit} caracteres",
    "string.empty": "Senha é obrigatória",
    "any.required": "Senha é obrigatória",
  }),
});

/**
 * Schema para validação de refresh token
 */
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    "string.empty": "Token de atualização é obrigatório",
    "any.required": "Token de atualização é obrigatório",
  }),
});

/**
 * Schema para validação de registro de usuário
 * Inclui regras para senha forte
 */
export const registerSchema = Joi.object({
  name: Joi.string().min(3).max(100).required().messages({
    "string.min": "Nome deve ter no mínimo {#limit} caracteres",
    "string.max": "Nome deve ter no máximo {#limit} caracteres",
    "string.empty": "Nome é obrigatório",
    "any.required": "Nome é obrigatório",
  }),

  email: Joi.string().email().required().messages({
    "string.email": "Email deve ser um endereço de email válido",
    "string.empty": "Email é obrigatório",
    "any.required": "Email é obrigatório",
  }),

  password: Joi.string()
    .min(8)
    .pattern(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/
    )
    .required()
    .messages({
      "string.min": "Senha deve ter no mínimo {#limit} caracteres",
      "string.pattern.base":
        "Senha deve conter pelo menos uma letra maiúscula, uma letra minúscula, um número e um caractere especial",
      "string.empty": "Senha é obrigatória",
      "any.required": "Senha é obrigatória",
    }),
});

/**
 * Schema para validação de alteração de senha
 */
export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    "string.empty": "Senha atual é obrigatória",
    "any.required": "Senha atual é obrigatória",
  }),

  newPassword: Joi.string()
    .min(8)
    .pattern(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/
    )
    .required()
    .invalid(Joi.ref("currentPassword")) // Nova senha não pode ser igual à atual
    .messages({
      "string.min": "Nova senha deve ter no mínimo {#limit} caracteres",
      "string.pattern.base":
        "Nova senha deve conter pelo menos uma letra maiúscula, uma letra minúscula, um número e um caractere especial",
      "string.empty": "Nova senha é obrigatória",
      "any.required": "Nova senha é obrigatória",
      "any.invalid": "Nova senha não pode ser igual à senha atual",
    }),
});
