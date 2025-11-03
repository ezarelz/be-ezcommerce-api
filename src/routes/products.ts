import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Public catalog and store browsing
 */

/* -------------------------------------------------------------------------- */
/*                            PUBLIC PRODUCT ROUTES                            */
/* -------------------------------------------------------------------------- */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: List products in the public catalog
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, price, name]
 *           default: newest
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Keyword to search in product titles
 *     responses:
 *       200:
 *         description: Paginated list of products
 */
router.get('/', async (req: Request, res: Response) => {
  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = parseInt((req.query.limit as string) || '20', 10);
  const sort = (req.query.sort as string) || 'newest';
  const order = (req.query.order as string) || 'desc';
  const q = (req.query.q as string) || undefined;

  const where: Prisma.ProductWhereInput = {};
  if (q) where.title = { contains: q, mode: 'insensitive' };

  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safePage = Math.max(page, 1);

  let orderBy: Prisma.ProductOrderByWithRelationInput;
  if (sort === 'price') orderBy = { price: order as Prisma.SortOrder };
  else if (sort === 'name') orderBy = { title: order as Prisma.SortOrder };
  else orderBy = { createdAt: order as Prisma.SortOrder };

  const total = await prisma.product.count({ where });
  const totalPages = Math.ceil(total / safeLimit);

  const products = await prisma.product.findMany({
    where,
    orderBy,
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
    include: { category: true, shop: true },
  });

  res.json({
    success: true,
    message: 'OK',
    data: {
      products,
      pagination: { page: safePage, limit: safeLimit, total, totalPages },
    },
  });
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product details (public)
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product details
 *       404:
 *         description: Product not found
 */
router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: true, shop: true },
  });
  if (!product)
    return res
      .status(404)
      .json({ success: false, message: 'Product not found' });
  res.json({ success: true, message: 'OK', data: { product } });
});

/**
 * @swagger
 * /api/stores/{id}:
 *   get:
 *     summary: Get store detail and its products (public)
 *     tags: [Products]
 */
router.get('/stores/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const shop = await prisma.shop.findUnique({
    where: { id },
    include: { products: true },
  });
  if (!shop)
    return res.status(404).json({ success: false, message: 'Store not found' });
  res.json({ success: true, message: 'OK', data: { shop } });
});

/**
 * @swagger
 * /api/stores/slug/{slug}:
 *   get:
 *     summary: Get store by slug with products (public)
 *     tags: [Products]
 */
router.get('/stores/slug/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const shop = await prisma.shop.findUnique({
    where: { slug },
    include: { products: true },
  });
  if (!shop)
    return res.status(404).json({ success: false, message: 'Store not found' });
  res.json({ success: true, message: 'OK', data: { shop } });
});

export default router;
