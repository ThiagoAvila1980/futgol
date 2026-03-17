import { describe, it, expect } from 'vitest';
import { loginSchema, registerSchema, groupSchema } from '../middleware/validation';

describe('Zod Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should accept valid login data', () => {
      const result = loginSchema.safeParse({ email: 'test@test.com', password: '123456' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({ email: 'not-email', password: '123456' });
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const result = loginSchema.safeParse({ email: 'test@test.com', password: '12' });
      expect(result.success).toBe(false);
    });

    it('should reject empty fields', () => {
      const result = loginSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('should accept valid registration data', () => {
      const result = registerSchema.safeParse({
        email: 'user@test.com',
        password: 'senha123',
        name: 'João Silva',
      });
      expect(result.success).toBe(true);
    });

    it('should accept registration with optional fields', () => {
      const result = registerSchema.safeParse({
        email: 'user@test.com',
        password: 'senha123',
        name: 'João Silva',
        phone: '11999999999',
        role: 'field_owner',
      });
      expect(result.success).toBe(true);
    });

    it('should reject registration without name', () => {
      const result = registerSchema.safeParse({
        email: 'user@test.com',
        password: 'senha123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid role', () => {
      const result = registerSchema.safeParse({
        email: 'user@test.com',
        password: 'senha123',
        name: 'Test',
        role: 'superadmin',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('groupSchema', () => {
    it('should accept valid group', () => {
      const result = groupSchema.safeParse({
        name: 'Pelada dos Amigos',
        adminId: 'user1',
        sport: 'Futebol Society',
      });
      expect(result.success).toBe(true);
    });

    it('should reject group without name', () => {
      const result = groupSchema.safeParse({ adminId: 'user1' });
      expect(result.success).toBe(false);
    });
  });
});
