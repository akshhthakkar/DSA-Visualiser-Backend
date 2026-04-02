// src/index.ts
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { initSentry } from './config/sentry.js';

import { Server as SocketServer } from 'socket.io';

// Initialize Sentry ideally before anything else evaluates too deeply
initSentry();

// In-memory room state for collaborative editor sync
const roomState = new Map<string, { code?: string; language?: string; output?: unknown }>();

async function start(): Promise<void> {
  const app = await buildApp();

  await app.ready();

  const io = new SocketServer(app.server, {
    cors: {
      origin: env.FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Make io accessible from routes via global
  (global as any).io = io;

  io.on('connection', (socket) => {
    socket.on(
      'join-room',
      ({ roomId, userId, role }: { roomId: string; userId: string; role: string }) => {
        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.userId = userId;
        socket.data.role = role;
        // Private room for targeted events (e.g. auto-score results sent only to host)
        socket.join(`user_${userId}`);
        // Sync new joiner with current room state
        if (roomState.has(roomId)) socket.emit('sync-state', roomState.get(roomId));
      }
    );

    socket.on(
      'code-change',
      ({ roomId, code, language }: { roomId: string; code: string; language: string }) => {
        const state = roomState.get(roomId) || {};
        roomState.set(roomId, { ...state, code, language });
        socket.to(roomId).emit('code-change', { code, language });
      }
    );

    socket.on(
      'language-change',
      ({ roomId, language, code }: { roomId: string; language: string; code: string }) => {
        const state = roomState.get(roomId) || {};
        roomState.set(roomId, { ...state, language, code });
        socket.to(roomId).emit('language-change', { language, code });
      }
    );

    socket.on('output-update', ({ roomId, output }: { roomId: string; output: unknown }) => {
      const state = roomState.get(roomId) || {};
      roomState.set(roomId, { ...state, output });
      socket.to(roomId).emit('output-update', { output });
    });

    socket.on(
      'problem-change',
      ({
        roomId,
        problemTitle,
        difficulty,
      }: {
        roomId: string;
        problemTitle: string;
        difficulty: string;
      }) => {
        socket.to(roomId).emit('problem-change', { problemTitle, difficulty });
      }
    );
  });

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`✅ Server + Socket.io running on http://localhost:${env.PORT}`);
  } catch (error) {
    app.log.error(error, '❌ Failed to start server');
    process.exit(1);
  }

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`${signal} received — shutting down`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void start();
