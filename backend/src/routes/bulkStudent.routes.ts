// src/routes/bulkStudent.routes.ts
// Bulk student creation endpoints — security hardened.
// Follows thin-route convention from admin.routes.ts.
//
// Security:
//   - requireAuth + requireAdmin on all routes
//   - Rate limited: max 3 bulk requests per 60 seconds per admin
//   - File size cap: 5MB (via @fastify/multipart in app.ts)
//   - Row count cap: 1000 per upload
//   - universityId derived server-side (not trusted from body)

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';
import * as bulkStudentService from '../services/bulkStudent.service.js';
import { bulkCreateJsonSchema } from '../types/bulkStudent.types.js';
import { parseCSV } from '../utils/csvParser.js';
import { ValidationError } from '../utils/errors.js';

const REQUIRED_CSV_COLUMNS = ['name', 'email', 'registerNumber', 'degree', 'batch'];

export default async function bulkStudentRoutes(app: FastifyInstance) {
  // --- Prefix-level hooks: auth + admin role on ALL routes ---
  app.addHook('onRequest', requireAuth);
  app.addHook('onRequest', requireAdmin);

  // ============================================
  // POST /upload-csv — CSV file upload
  // Rate limited: 3 requests per 60 seconds
  // ============================================
  app.post(
    '/upload-csv',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '60 seconds',
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Get the uploaded file from multipart
      const data = await request.file();

      if (!data) {
        throw new ValidationError('No file uploaded');
      }

      // Validate file type
      const filename = data.filename.toLowerCase();
      if (!filename.endsWith('.csv') && data.mimetype !== 'text/csv') {
        throw new ValidationError('Only CSV files are allowed');
      }

      // Read file buffer
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);

      // Get universityId from fields (optional — service will derive if needed)
      const fields = data.fields;
      const universityIdField = fields['universityId'];
      const universityId =
        universityIdField && 'value' in universityIdField
          ? (universityIdField as any).value
          : undefined;

      // Parse CSV (with injection protection in csvParser)
      const parsed = await parseCSV(fileBuffer, {
        requiredColumns: REQUIRED_CSV_COLUMNS,
        transform: (row: any) => ({
          name: row.name?.trim(),
          email: row.email?.trim().toLowerCase(),
          registerNumber: row.registerNumber?.trim(),
          degree: row.degree?.trim(),
          batch: row.batch?.trim(),
          password: row.password?.trim() || undefined,
        }),
      });

      if (parsed.errors.length > 0) {
        return reply.status(400).send({
          code: 'CSV_PARSE_ERROR',
          errors: parsed.errors,
        });
      }

      if (parsed.data.length === 0) {
        throw new ValidationError('CSV file contains no data rows');
      }

      if (parsed.data.length > 1000) {
        throw new ValidationError('CSV file exceeds maximum of 1000 rows');
      }

      // Bulk create — universityId resolved server-side in service
      const result = await bulkStudentService.createStudentsBulk(
        parsed.data,
        universityId as string | undefined,
        request.user!.userId,
        request.user!.role,
        request.ip,
        request.headers['user-agent'],
        request.id,
        data.filename // pass filename for import history
      );

      void reply.status(201).send(result);
    }
  );

  // ============================================
  // POST /bulk-create — JSON body
  // Rate limited: 3 requests per 60 seconds
  // ============================================
  app.post(
    '/bulk-create',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '60 seconds',
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const bodyResult = bulkCreateJsonSchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw new ValidationError('Validation failed', bodyResult.error.issues);
      }

      // universityId is optional in body — service derives from admin profile
      const result = await bulkStudentService.createStudentsBulk(
        bodyResult.data.students,
        bodyResult.data.universityId,
        request.user!.userId,
        request.user!.role,
        request.ip,
        request.headers['user-agent'],
        request.id,
        'json-upload' // fileName for history
      );

      void reply.status(201).send(result);
    }
  );

  // ============================================
  // POST /validate-csv — dry-run validation (NO DB writes)
  // Returns valid + invalid rows so the frontend can preview.
  // ============================================
  app.post('/validate-csv', async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await request.file();

    if (!data) {
      throw new ValidationError('No file uploaded');
    }

    const filename = data.filename.toLowerCase();
    if (!filename.endsWith('.csv') && data.mimetype !== 'text/csv') {
      throw new ValidationError('Only CSV files are allowed');
    }

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);

    const fields = data.fields;
    const universityIdField = fields['universityId'];
    const universityId =
      universityIdField && 'value' in universityIdField
        ? (universityIdField as any).value
        : undefined;

    const parsed = await parseCSV(fileBuffer, {
      requiredColumns: REQUIRED_CSV_COLUMNS,
      transform: (row: any) => ({
        name: row.name?.trim(),
        email: row.email?.trim().toLowerCase(),
        registerNumber: row.registerNumber?.trim(),
        degree: row.degree?.trim(),
        batch: row.batch?.trim(),
        password: row.password?.trim() || undefined,
      }),
    });

    if (parsed.errors.length > 0) {
      return reply.status(400).send({
        code: 'CSV_PARSE_ERROR',
        errors: parsed.errors,
      });
    }

    if (parsed.data.length === 0) {
      throw new ValidationError('CSV file contains no data rows');
    }

    if (parsed.data.length > 1000) {
      throw new ValidationError('CSV file exceeds maximum of 1000 rows');
    }

    // Validate only — no DB writes
    const result = await bulkStudentService.validateStudentsBulk(
      parsed.data,
      universityId as string | undefined,
      request.user!.userId,
      request.user!.role
    );

    void reply.status(200).send(result);
  });

  // ============================================
  // GET /history — paginated import history
  // ============================================
  app.get(
    '/history',
    async (
      request: FastifyRequest<{ Querystring: { page?: string; limit?: string } }>,
      reply: FastifyReply
    ) => {
      const page = Math.max(1, parseInt(request.query.page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || '20', 10)));

      // Resolve admin's university for scoping (SUPER_ADMIN sees all)
      const universityId =
        request.user!.role === 'SUPER_ADMIN'
          ? null
          : await (async () => {
              const profileUni = await import('../repositories/bulkStudent.repository.js').then(
                (m) => m.resolveAdminUniversity(request.user!.userId)
              );
              return profileUni;
            })();

      const result = await import('../repositories/bulkStudent.repository.js').then((m) =>
        m.getBulkImports(universityId, page, limit)
      );

      void reply.status(200).send(result);
    }
  );

  // ============================================
  // GET /template — Download CSV template
  // ============================================
  app.get('/template', async (_request: FastifyRequest, reply: FastifyReply) => {
    const template = `name,email,registerNumber,degree,batch,password
John Doe,john.doe@university.edu,2024CS001,Computer Science,2024,
Jane Smith,jane.smith@university.edu,2024CS002,Computer Science,2024,
Bob Wilson,bob.wilson@university.edu,2024CS003,Computer Science,2024,`;

    void reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', 'attachment; filename="student_import_template.csv"')
      .send(template);
  });
}
