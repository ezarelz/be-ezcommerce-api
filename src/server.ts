import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

import authRoutes from './routes/auth';
import categoryRoutes from './routes/categories';
import productRoutes from './routes/products';

// Load .env
dotenv.config();

const app = express();
const prisma = new PrismaClient();

const PORT = Number(process.env.PORT || 4000);
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// ===== Middlewares =====
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// ===== Swagger =====
const routesGlob =
  process.env.NODE_ENV === 'production'
    ? ['./dist/routes/*.js']
    : ['./src/routes/*.ts'];

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'E-Commerce API',
      version: '1.0.0',
      description: 'REST API for an e-commerce application (demo).',
    },
    servers: [{ url: SERVER_URL }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: routesGlob,
};

const swaggerSpec = swaggerJsdoc(swaggerOptions as any);
app.use(
  '/api-swagger',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, { explorer: true })
);

// ===== Root & Health =====
app.get('/', (_req, res) => {
  res.json({
    message: '🚀 E-commerce API is running!',
    docs: `${SERVER_URL}/api-swagger`,
    health: `${SERVER_URL}/health`,
  });
});

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', error: (e as Error).message });
  }
});

// ===== Routes =====
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);

// ===== 404 =====
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ===== Error handler (last) =====
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const msg = err instanceof Error ? err.message : 'Unknown error';
  res.status(500).json({ error: msg });
});

// ===== Start =====
app.listen(PORT, () => {
  console.log(`✅ Server running on ${SERVER_URL}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
