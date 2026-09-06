import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import apiRouter from './src/routes/apiRouter.ts';
import { errorHandler } from './src/middleware/errorHandler.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors({
    origin: true,
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // API routes FIRST
  const api = (apiRouter && typeof apiRouter === 'object' && (apiRouter as any).default) ? (apiRouter as any).default : apiRouter;
  app.use('/api', api);

  // Vite middleware for development / static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global error handler
  const errHandler = (errorHandler && typeof errorHandler === 'object' && (errorHandler as any).default) ? (errorHandler as any).default : errorHandler;
  app.use(errHandler);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Student Digital ID Card System server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
