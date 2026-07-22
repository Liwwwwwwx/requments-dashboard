import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { authMiddleware } from '../../src/auth/middleware';

function appWith(users: { findById: (id: string) => Promise<unknown> }) {
  const app = express();
  app.get('/protected', authMiddleware(users), (req, res) => res.json({ user: req.user }));
  return app;
}

describe('API token user binding', () => {
  it('uses the configured real user for API-token requests', async () => {
    const previousToken = process.env.REQUIREMENTS_API_TOKEN;
    const previousUserId = process.env.REQUIREMENTS_API_USER_ID;
    process.env.REQUIREMENTS_API_TOKEN = 'test-token';
    process.env.REQUIREMENTS_API_USER_ID = 'u-owner';
    try {
      const res = await request(appWith({ findById: async (id) => id === 'u-owner' ? { id, username: 'owner', display_name: 'Owner', role: 'member' } : null }))
        .get('/protected')
        .set('Authorization', 'Bearer test-token');
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ id: 'u-owner', username: 'owner' });
    } finally {
      if (previousToken === undefined) delete process.env.REQUIREMENTS_API_TOKEN; else process.env.REQUIREMENTS_API_TOKEN = previousToken;
      if (previousUserId === undefined) delete process.env.REQUIREMENTS_API_USER_ID; else process.env.REQUIREMENTS_API_USER_ID = previousUserId;
    }
  });

  it('rejects API tokens that have no configured user', async () => {
    const previousToken = process.env.REQUIREMENTS_API_TOKEN;
    const previousUserId = process.env.REQUIREMENTS_API_USER_ID;
    process.env.REQUIREMENTS_API_TOKEN = 'test-token';
    delete process.env.REQUIREMENTS_API_USER_ID;
    try {
      const res = await request(appWith({ findById: async () => null }))
        .get('/protected')
        .set('Authorization', 'Bearer test-token');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('API_TOKEN_USER_NOT_CONFIGURED');
    } finally {
      if (previousToken === undefined) delete process.env.REQUIREMENTS_API_TOKEN; else process.env.REQUIREMENTS_API_TOKEN = previousToken;
      if (previousUserId === undefined) delete process.env.REQUIREMENTS_API_USER_ID; else process.env.REQUIREMENTS_API_USER_ID = previousUserId;
    }
  });
});
