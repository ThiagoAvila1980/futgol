import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  phone: z.string().optional(),
  nickname: z.string().optional(),
  birthDate: z.string().optional(),
  favoriteTeam: z.string().optional(),
  position: z.string().optional(),
  avatar: z.string().optional(),
  role: z.enum(['user', 'field_owner']).optional(),
});

export const profileSchema = z.object({
  id: z.string(),
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  avatar: z.string().optional(),
  birthDate: z.string().optional(),
  favoriteTeam: z.string().optional(),
  primaryGroupId: z.string().optional(),
});

export const groupSchema = z.object({
  name: z.string().min(2, 'Nome do grupo requerido'),
  sport: z.string().optional(),
  adminId: z.string(),
  city: z.string().optional(),
  paymentMode: z.enum(['split', 'fixed']).optional(),
  fixedAmount: z.number().optional(),
  monthlyFee: z.number().optional(),
}).passthrough();

export const matchSchema = z.object({
  groupId: z.string(),
  date: z.string(),
  time: z.string().optional(),
  fieldId: z.string().optional(),
}).passthrough();

export const transactionSchema = z.object({
  groupId: z.string(),
  description: z.string(),
  amount: z.number(),
  type: z.enum(['INCOME', 'EXPENSE']),
  date: z.string(),
  category: z.string(),
}).passthrough();

export const fieldSchema = z.object({
  name: z.string().min(1, 'Nome do campo requerido'),
  location: z.string().optional(),
}).passthrough();

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({ error: 'Dados inválidos', details: errors });
    }
    req.body = result.data;
    next();
  };
}
