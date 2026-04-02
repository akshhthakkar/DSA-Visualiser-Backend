import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { getTestServer } from '../helpers/testServer.js';
import { createTestUser, createTestUniversity } from '../helpers/fixtures.js';
import { getMockAuthToken } from '../helpers/mockAuth.js';
import type { FastifyInstance } from 'fastify';

describe('Admin Routes Integration', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let studentToken: string;
  let superAdminToken: string;
  let targetUserId: string;

  beforeAll(async () => {
    app = await getTestServer();
  });

  beforeEach(async () => {
    await createTestUniversity();

    // Create Users
    const admin = await createTestUser({
      email: `admin-routes-${Date.now()}@test.edu`,
      role: 'ADMIN',
    });
    const superAdmin = await createTestUser({
      email: `super-routes-${Date.now()}@test.edu`,
      role: 'SUPER_ADMIN',
    });
    const student = await createTestUser({
      email: `student-routes-${Date.now()}@test.edu`,
      role: 'STUDENT',
    });

    // A target user that we can modify/delete
    const target = await createTestUser({
      email: `target-routes-${Date.now()}@test.edu`,
      role: 'STUDENT',
      name: 'Target User',
    });
    targetUserId = target.id;

    // Tokens
    adminToken = getMockAuthToken(admin.id, admin.email, admin.role);
    superAdminToken = getMockAuthToken(superAdmin.id, superAdmin.email, superAdmin.role);
    studentToken = getMockAuthToken(student.id, student.email, student.role);
  });

  describe('GET /api/admin/users', () => {
    it('should allow ADMIN to list users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/users',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.users).toBeInstanceOf(Array);
      expect(data.pagination).toBeDefined();
    });

    it('should prevent STUDENT from listing users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/users',
        headers: { authorization: `Bearer ${studentToken}` },
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /api/admin/users/:id', () => {
    it('should return user details for valid ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/users/${targetUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.userId).toBe(targetUserId);
    });

    it('should return 404 for invalid ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/users/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/admin/users/:id', () => {
    it('should allow ADMIN to update user fields', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/admin/users/${targetUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Updated Target Name' },
      });
      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.name).toBe('Updated Target Name');
    });
  });

  describe('PUT /api/admin/users/:id/role', () => {
    it('should allow SUPER_ADMIN to change role to ADMIN', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/admin/users/${targetUserId}/role`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { role: 'ADMIN' },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().role).toBe('ADMIN');
    });

    it('should reject changing role to SUPER_ADMIN', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/admin/users/${targetUserId}/role`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { role: 'SUPER_ADMIN' },
      });
      expect(response.statusCode).toBe(400); // Validation error handled properly
    });
  });

  describe('DELETE /api/admin/users/:id', () => {
    it('should allow ADMIN to delete a student', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/admin/users/${targetUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(204);

      // Verify deletion
      const checkResponse = await app.inject({
        method: 'GET',
        url: `/api/admin/users/${targetUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(checkResponse.statusCode).toBe(404);
    });
  });
});
