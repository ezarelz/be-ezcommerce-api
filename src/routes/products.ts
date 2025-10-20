import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Public catalog and seller products
 */

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
 *         description: Page number (1‑based)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of products per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, price, name]
 *           default: newest
 *         description: Field to sort by
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort direction
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search keyword applied to product titles
 *       - in: query
 *         name: ids
 *         schema:
 *           type: string
 *         description: Comma‑separated list of product IDs to include
 *     responses:
 *       200:
 *         description: A paginated list of products
 */
router.get('/', async (req: Request, res: Response) => {
  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = parseInt((req.query.limit as string) || '20', 10);
  const sort = (req.query.sort as string) || 'newest';
  const order = (req.query.order as string) || 'desc';
  const q = (req.query.q as string) || undefined;
  const idsParam = (req.query.ids as string) || undefined;

  // Validate limit and page
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safePage = Math.max(page, 1);

  const where: Prisma.ProductWhereInput = {};
  if (q) {
    where.title = { contains: q, mode: 'insensitive' };
  }
  if (idsParam) {
    const ids = idsParam.split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean);
    where.id = { in: ids };
  }

  // Determine sort field
  let orderBy: Prisma.ProductOrderByWithRelationInput;
  if (sort === 'price') {
    orderBy = { price: order as Prisma.SortOrder };
  } else if (sort === 'name') {
    orderBy = { title: order as Prisma.SortOrder };
  } else {
    // newest sorts by createdAt
    orderBy = { createdAt: order as Prisma.SortOrder };
  }

  const total = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));

  const products = await prisma.product.findMany({
    where,
    orderBy,
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
    include: {
      category: true,
      shop: true,
    },
  });

  res.json({
    success: true,
    message: 'OK',
    data: {
      products,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
      },
    },
  });
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product detail (public)
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Numeric ID of the product
 *     responses:
 *       200:
 *         description: The product details
 *       404:
 *         description: Product not found
 */
router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      shop: true,
    },
  });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ success: true, message: 'OK', data: { product } });
});

export default router;