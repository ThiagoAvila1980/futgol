import { describe, it, expect, vi } from 'vitest';
import bcrypt from 'bcryptjs';

describe('Auth - Password Hashing', () => {
  it('should hash password with bcrypt', async () => {
    const password = 'test123456';
    const hash = await bcrypt.hash(password, 12);

    expect(hash).toBeTruthy();
    expect(hash).not.toBe(password);
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('should verify bcrypt password correctly', async () => {
    const password = 'minhasenha123';
    const hash = await bcrypt.hash(password, 12);

    const valid = await bcrypt.compare(password, hash);
    const invalid = await bcrypt.compare('senhaerrada', hash);

    expect(valid).toBe(true);
    expect(invalid).toBe(false);
  });

  it('should detect SHA-256 vs bcrypt hash format', () => {
    const sha256Hash = 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3';
    const bcryptHash = '$2a$12$WApznUPhDubN0oeveSXHpOXlwC5i3VqZZz0';

    expect(sha256Hash.startsWith('$2')).toBe(false);
    expect(bcryptHash.startsWith('$2')).toBe(true);
  });
});

describe('Auth - JWT Token', () => {
  it('should create a valid JWT structure', async () => {
    const jwt = await import('jsonwebtoken');
    const secret = 'test-secret';
    const payload = { sub: 'user123', email: 'test@test.com', role: 'user' };

    const token = jwt.default.sign(payload, secret, { expiresIn: '7d' });
    expect(token).toBeTruthy();
    expect(token.split('.')).toHaveLength(3);

    const decoded = jwt.default.verify(token, secret) as any;
    expect(decoded.sub).toBe('user123');
    expect(decoded.email).toBe('test@test.com');
  });
});
