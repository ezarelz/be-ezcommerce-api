// server.ts
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// === Import routes ===
import authRoutes from './routes/auth';
import sellerRoutes from './routes/seller';
import productRoutes from './routes/products';
import sellerProductRoutes from './routes/sellerProducts';
import categoriesRoutes from './routes/categories';
import cartRoutes from './routes/cart';
import ordersRoutes from './routes/orders';
import sellerFulfillmentRoutes from './routes/sellerFulfillment';
import reviewsRoutes from './routes/reviews';

// === auth middleware (needed for /api/me) ===
import { authenticate } from './middlewares/auth';

// === Load env ===
dotenv.config();

const app = express();
const prisma = new PrismaClient();

const PORT = Number(process.env.PORT || 4000);
const NODE_ENV = process.env.NODE_ENV || 'development';
const SERVER_URL =
  process.env.SERVER_URL ||
  (NODE_ENV === 'production'
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${PORT}`);
const FRONTEND_DOMAIN = process.env.FRONTEND_DOMAIN || '*';

// ===== Middlewares =====
app.use(cors({ origin: FRONTEND_DOMAIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== Swagger setup =====
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
      description: 'REST API for an e-commerce application (demo) by EzarElz.',
    },
    servers: [{ url: SERVER_URL }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Enter JWT token obtained from `/api/auth/login` (without the word "Bearer").',
        },
      },
      schemas: {
        AuthError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Unauthorized' },
            message: {
              type: 'string',
              example: 'Missing or invalid authentication token',
            },
          },
        },
        ServerError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Internal Server Error' },
          },
        },
        BasicOK: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation successful' },
          },
        },
        BadRequest: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Invalid input or parameter' },
          },
        },
      },
    },
    // ✅ Global security — semua route default pakai bearerAuth
    security: [{ bearerAuth: [] }],
    tags: [
      {
        name: 'Auth',
        description: 'Endpoints for user registration and login',
      },
      { name: 'Seller', description: 'Seller activation & shop management' },
      { name: 'Products', description: 'Public catalog of products' },
      {
        name: 'Seller Products',
        description: 'Manage your own shop products (upload, edit, delete)',
      },
      { name: 'Categories', description: 'Product categories' },
      { name: 'Cart', description: 'Shopping cart per user' },
      { name: 'Orders', description: 'Checkout & buyer orders' },
      {
        name: 'Seller Fulfillment',
        description: 'Seller order items handling',
      },
      { name: 'Reviews', description: 'Product reviews & ratings' },
    ],
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
// Keep existing mounts (auth under /api/auth)
app.use('/api/auth', authRoutes);
app.use('/api/seller', sellerRoutes); // seller activation/shop
app.use('/api/products', productRoutes);
app.use('/api/seller', sellerProductRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/seller-fulfillment', sellerFulfillmentRoutes);
app.use('/api/reviews', reviewsRoutes);

// ===== Add /api/me (GET + PATCH) directly here so FE can call /api/me =====
app.get(
  '/api/me',
  authenticate,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      // token payload userId might be string; cast to number
      const userId = Number(req.user?.userId);
      if (Number.isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user id in token' });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ error: 'User not found' });

      return res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        isSeller: user.isSeller,
      });
    } catch (err) {
      console.error('GET /api/me error', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

app.patch(
  '/api/me',
  authenticate,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const { name } = req.body as { name?: string };
      if (!name) return res.status(400).json({ error: 'name is required' });

      const userId = Number(req.user?.userId);
      if (Number.isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user id in token' });
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: { name },
      });

      return res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        isSeller: user.isSeller,
      });
    } catch (err) {
      console.error('PATCH /api/me error', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ===== 404 handler =====
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ===== Error handler =====
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const msg = err instanceof Error ? err.message : 'Unknown error';
  res.status(500).json({ error: msg });
});

// ===== Start server =====
app.listen(PORT, () => {
  console.log(`✅ Server running on ${SERVER_URL}`);
  console.log(`🌐 CORS allowed for: ${FRONTEND_DOMAIN}`);
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
