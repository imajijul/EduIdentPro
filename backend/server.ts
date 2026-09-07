import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import apiRouter from './src/routes/apiRouter';
import { errorHandler } from './src/middleware/errorHandler';
import { getDatabasePool } from './src/config/database';

export function createBackendApp() {
  const app = express();

  const allowedOrigin =
    process.env.FRONTEND_URL || 'http://localhost:5173';

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        if (
          origin === allowedOrigin ||
          origin === 'http://localhost:5173' ||
          origin === 'http://localhost:3000' ||
          origin.endsWith('.run.app')
        ) {
          return callback(null, true);
        }

        return callback(null, true);
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'student-digital-id-card-backend',
    });
  });

  // API routes
  app.use('/api', apiRouter);

  // Global error handler
  app.use(errorHandler);

  return app;
}

export const app = createBackendApp();

const PORT = Number(process.env.PORT) || 5000;

getDatabasePool()
  .then(() => {
    console.log('PostgreSQL connection pool initialized.');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(
        `Backend server listening on http://0.0.0.0:${PORT}`
      );
    });
  })
  .catch((err) => {
    console.error(
      'Failed to connect to database at startup:',
      err.message
    );

    process.exit(1);
  });