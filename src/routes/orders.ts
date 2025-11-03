// routes/orders.ts
import { Router, type Request, type Response } from 'express';
import prisma from '../libs/prisma';
import { authenticateUser } from '../middlewares/auth';
import { Prisma, OrderStatus } from '@prisma/client';

type AuthedRequest = Request & { user?: { userId: number } };

const router = Router();

const toInt = (v: unknown, d = 0): number => {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : d;
};
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

/* -------------------------------------------
   Prisma helper args (aman untuk TS)
-------------------------------------------- */
const orderWithItemsArgs = Prisma.validator<Prisma.OrderDefaultArgs>()({
  include: { items: true },
});
type OrderWithItems = Prisma.OrderGetPayload<typeof orderWithItemsArgs>;

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Buyer order operations
 *
 * components:
 *   schemas:
 *     OrderItemBasic:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 10 }
 *         orderId: { type: integer, example: 555 }
 *         productId: { type: integer, example: 101 }
 *         quantity: { type: integer, example: 2 }
 *         price: { type: integer, example: 99000 }
 *         status: { type: string, enum: [PENDING, COMPLETED, CANCELLED], example: "PENDING" }
 *     OrderBasic:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 555 }
 *         userId: { type: integer, example: 5 }
 *         status: { type: string, enum: [PENDING, PAID, CANCELLED, COMPLETED], example: "PAID" }
 *         total: { type: integer, example: 198000 }
 *         createdAt: { type: string, format: date-time }
 *         items:
 *           type: array
 *           items: { $ref: '#/components/schemas/OrderItemBasic' }
 *     CheckoutPayload:
 *       type: object
 *       properties:
 *         selectedItemIds:
 *           type: array
 *           items: { type: integer }
 *           example: [1, 2, 3]
 */

/**
 * POST /api/orders/checkout
 * Membuat satu order dari cart user. Order.status di-set PAID (mock payment).
 *
 * @swagger
 * tags:
 *   - name: Orders
 *     description: Buyer order operations
 *
 * components:
 *   schemas:
 *     CheckoutPayload:
 *       type: object
 *       required:
 *         - address
 *         - shipping
 *         - payment
 *       properties:
 *         address:
 *           type: string
 *           example: "Jl. Mawar No. 10, Bekasi"
 *           description: Alamat pengiriman
 *         shipping:
 *           type: string
 *           enum: [JNT, JNE]
 *           example: JNE
 *           description: Metode pengiriman
 *         payment:
 *           type: string
 *           enum: [BCA, BRI, BNI, MANDIRI]
 *           example: BCA
 *           description: Metode pembayaran
 *         selectedItemIds:
 *           type: array
 *           items:
 *             type: integer
 *           example: [1, 2, 3]
 *           description: (Opsional) Daftar ID cart item yang ingin di-checkout
 *
 * /api/orders/checkout:
 *   post:
 *     summary: Checkout cart items into a single order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CheckoutPayload'
 *     responses:
 *       200:
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Order created"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 55
 *                     address:
 *                       type: string
 *                       example: "Jl. Mawar No. 10, Bekasi"
 *                     shipping:
 *                       type: string
 *                       example: "JNE"
 *                     payment:
 *                       type: string
 *                       example: "BCA"
 *                     grandTotal:
 *                       type: integer
 *                       example: 1250000
 *                     status:
 *                       type: string
 *                       enum: [PAID, PENDING, COMPLETED, CANCELLED]
 *                       example: "PAID"
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           productId:
 *                             type: integer
 *                             example: 12
 *                           quantity:
 *                             type: integer
 *                             example: 2
 *                           price:
 *                             type: integer
 *                             example: 250000
 *       400:
 *         description: Cart is empty or missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 message: { type: string, example: "Missing required fields" }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 message: { type: string, example: "Internal Server Error" }
 */

router.post(
  '/checkout',
  authenticateUser,
  async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { address, shipping, payment, selectedItemIds } = req.body as {
        address?: string;
        shipping?: 'JNT' | 'JNE';
        payment?: 'BCA' | 'BRI' | 'BNI' | 'MANDIRI';
        selectedItemIds?: number[];
      };

      // 🔍 Validasi basic input
      if (!address || !shipping || !payment) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: address, shipping, or payment',
        });
        return;
      }

      const items = await prisma.cartItem.findMany({
        where: {
          userId,
          ...(selectedItemIds ? { id: { in: selectedItemIds } } : {}),
        },
        include: { product: true },
      });

      if (items.length === 0) {
        res.status(400).json({ success: false, message: 'Cart is empty' });
        return;
      }

      const total = items.reduce(
        (sum, ci) => sum + ci.quantity * ci.product.price,
        0
      );

      // 🧾 Transaksi utama
      const order: OrderWithItems = await prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            userId,
            status: 'PAID', // mock paid
            total,
            address,
            shipping,
            payment,
            items: {
              create: items.map((ci) => ({
                productId: ci.productId,
                quantity: ci.quantity,
                price: ci.product.price,
                status: 'PENDING',
              })),
            },
          },
          include: orderWithItemsArgs.include,
        });

        // Update stok & clear cart
        for (const ci of items) {
          await tx.product.update({
            where: { id: ci.productId },
            data: { stock: { decrement: ci.quantity } },
          });
          await tx.cartItem.delete({ where: { id: ci.id } });
        }

        return created;
      });

      res.json({
        success: true,
        message: 'Order created',
        data: {
          id: order.id,
          address,
          shipping,
          payment,
          grandTotal: total,
          items: order.items,
          status: order.status,
        },
      });
    } catch (err) {
      console.error('Checkout error:', err);
      res
        .status(500)
        .json({ success: false, message: 'Internal Server Error' });
    }
  }
);

/**
 * GET /api/orders/my
 * Query: page=1, limit=10, status?
 *
 * @swagger
 * /api/orders/my:
 *   get:
 *     summary: List my orders (paginated)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, PAID, CANCELLED, COMPLETED]
 *     responses:
 *       200:
 *         description: Orders fetched
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       500:
 *         description: Server error
 */
router.get(
  '/my',
  authenticateUser,
  async (req: AuthedRequest, res: Response) => {
    try {
      const page = clamp(toInt(req.query.page, 1), 1, 10_000_000);
      const limit = clamp(toInt(req.query.limit, 10), 1, 100);

      const statusParam = req.query.status
        ? String(req.query.status).toUpperCase()
        : undefined;

      // Build a properly typed where
      const where: Prisma.OrderWhereInput = { userId: req.user!.userId };

      if (statusParam) {
        const allowed = new Set(Object.values(OrderStatus) as string[]);
        if (!allowed.has(statusParam)) {
          res.status(400).json({
            success: false,
            message: `Invalid status. Allowed: ${[...allowed].join(', ')}`,
          });
          return;
        }
        // Assign as enum, not plain string
        where.status = statusParam as OrderStatus;
        // Alternatively: where.status = { equals: statusParam as OrderStatus };
      }

      const orders = await prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: orderWithItemsArgs.include, // keep your existing include helper
      });

      res.json({ success: true, message: 'OK', data: orders });
    } catch {
      res
        .status(500)
        .json({ success: false, message: 'Internal Server Error' });
    }
  }
);

/**
 * GET /api/orders/{id}
 *
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Get a specific order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Order found
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       404:
 *         description: Order not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:id',
  authenticateUser,
  async (req: AuthedRequest, res: Response) => {
    try {
      const id = toInt(req.params.id);
      const order = await prisma.order.findFirst({
        where: { id, userId: req.user!.userId },
        include: orderWithItemsArgs.include,
      });
      if (!order) {
        res.status(404).json({ success: false, message: 'Order not found' });
        return;
      }
      res.json({ success: true, message: 'OK', data: order });
    } catch {
      res
        .status(500)
        .json({ success: false, message: 'Internal Server Error' });
    }
  }
);

/**
 * PATCH /api/orders/items/{id}/complete
 * Hanya dari PENDING → COMPLETED. Jika semua COMPLETED, order → COMPLETED.
 *
 * @swagger
 * /api/orders/items/{id}/complete:
 *   patch:
 *     summary: Mark an order item as completed
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Order item marked as completed
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       403:
 *         description: Invalid status transition
 *       404:
 *         description: Order item not found
 *       500:
 *         description: Server error
 */
router.patch(
  '/items/:id/complete',
  authenticateUser,
  async (req: AuthedRequest, res: Response) => {
    try {
      const id = toInt(req.params.id);
      const item = await prisma.orderItem.findUnique({
        where: { id },
        include: { order: { include: { items: true } } },
      });

      if (!item || item.order.userId !== req.user!.userId) {
        res
          .status(404)
          .json({ success: false, message: 'Order item not found' });
        return;
      }
      if (item.status !== 'PENDING') {
        res
          .status(403)
          .json({ success: false, message: 'Invalid status transition' });
        return;
      }

      // update item
      const updated = await prisma.orderItem.update({
        where: { id },
        data: { status: 'COMPLETED' },
      });

      // jika semua item completed → order completed
      const stillPending = item.order.items.some(
        (oi) => oi.id !== id && oi.status !== 'COMPLETED'
      );
      if (!stillPending) {
        await prisma.order.update({
          where: { id: item.orderId },
          data: { status: 'COMPLETED' },
        });
      }

      res.json({
        success: true,
        message: 'Order item marked as completed',
        data: updated,
      });
    } catch {
      res
        .status(500)
        .json({ success: false, message: 'Internal Server Error' });
    }
  }
);

/**
 * PATCH /api/orders/{id}/cancel
 * Tidak boleh jika ada item COMPLETED. Item PENDING di-CANCELLED dan stok di-restore.
 *
 * @swagger
 * /api/orders/{id}/cancel:
 *   patch:
 *     summary: Cancel an order (restocks pending items)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, example: "Changed my mind" }
 *     responses:
 *       200:
 *         description: Order cancelled
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Order has completed items
 *       404:
 *         description: Order not found
 *       500:
 *         description: Server error
 */
router.patch(
  '/:id/cancel',
  authenticateUser,
  async (req: AuthedRequest, res: Response) => {
    try {
      const id = toInt(req.params.id);

      const order = await prisma.order.findFirst({
        where: { id, userId: req.user!.userId },
        include: { items: true },
      });

      if (!order) {
        res.status(404).json({ success: false, message: 'Order not found' });
        return;
      }

      const hasCompleted = order.items.some((oi) => oi.status === 'COMPLETED');
      if (hasCompleted) {
        res
          .status(403)
          .json({ success: false, message: 'Order has completed items' });
        return;
      }

      await prisma.$transaction(async (tx) => {
        for (const oi of order.items) {
          if (oi.status === 'PENDING') {
            await tx.orderItem.update({
              where: { id: oi.id },
              data: { status: 'CANCELLED' },
            });
            await tx.product.update({
              where: { id: oi.productId },
              data: { stock: { increment: oi.quantity } },
            });
          }
        }

        await tx.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED' },
        });
      });

      res.json({ success: true, message: 'Order cancelled' });
    } catch {
      res
        .status(500)
        .json({ success: false, message: 'Internal Server Error' });
    }
  }
);

export default router;
