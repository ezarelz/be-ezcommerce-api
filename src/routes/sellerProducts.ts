import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser } from '../middlewares/auth';
import upload from '../middlewares/upload';

const prisma = new PrismaClient();
const router = Router();

/**
 * @swagger
 * tags:
 *   name: Seller Products
 *   description: Manage your shop products (upload, edit, delete)
 *
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         title:
 *           type: string
 *           example: "Minimalist Sneaker"
 *         description:
 *           type: string
 *           example: "Comfortable casual shoes"
 *         price:
 *           type: number
 *           example: 250000
 *         images:
 *           type: array
 *           items:
 *             type: string
 *             example: "https://res.cloudinary.com/.../product.png"
 *         stock:
 *           type: integer
 *           example: 15
 *         rating:
 *           type: number
 *           example: 4.5
 *         reviewCount:
 *           type: integer
 *           example: 12
 *         soldCount:
 *           type: integer
 *           example: 30
 *         categoryId:
 *           type: integer
 *           example: 2
 *         shopId:
 *           type: integer
 *           example: 1
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2025-10-31T20:41:12.986Z"
 */

// =====================================================
// GET /api/seller/products
// =====================================================
/**
 * @swagger
 * /api/seller/products:
 *   get:
 *     summary: Get all products from the authenticated seller's shop
 *     tags: [Seller Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successful response with list of products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     products:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Product'
 *       404:
 *         description: Shop not found for the authenticated user
 *       500:
 *         description: Internal server error
 */
router.get('/products', authenticateUser, async (req: any, res) => {
  console.log('➡️ [GET] /api/seller/products hit');

  try {
    const shop = await prisma.shop.findUnique({
      where: { userId: req.user.userId },
      include: { products: true },
    });

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found',
      });
    }

    res.json({
      success: true,
      message: 'OK',
      data: { products: shop.products },
    });
  } catch (err) {
    console.error('❌ Error in GET /seller/products:', err);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
    });
  }
});

// =====================================================
// POST /api/seller/products
// =====================================================
/**
 * @swagger
 * /api/seller/products:
 *   post:
 *     summary: Create a new product in the seller's shop
 *     tags: [Seller Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - price
 *               - stock
 *               - categoryId
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Minimalist Sneaker"
 *               description:
 *                 type: string
 *                 example: "Comfortable casual shoes"
 *               price:
 *                 type: number
 *                 example: 250000
 *               stock:
 *                 type: number
 *                 example: 15
 *               categoryId:
 *                 type: integer
 *                 example: 1
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     product:
 *                       $ref: '#/components/schemas/Product'
 *       400:
 *         description: Invalid categoryId or missing fields
 *       404:
 *         description: Shop not found
 *       500:
 *         description: Internal Server Error
 */
router.post(
  '/products',
  authenticateUser,
  upload.array('images', 5),
  async (req: any, res) => {
    console.log('➡️ [POST] /api/seller/products hit');

    try {
      const userId = req.user?.userId;
      const { title, description, price, stock, categoryId } = req.body;
      const shop = await prisma.shop.findUnique({ where: { userId } });

      if (!shop) {
        return res.status(404).json({
          success: false,
          message: 'Shop not found',
        });
      }

      const imagePaths = req.files?.map((f: any) => f.path) ?? [];

      const parsedCategory = parseInt(categoryId, 10);
      if (isNaN(parsedCategory)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid categoryId',
        });
      }

      const product = await prisma.product.create({
        data: {
          title,
          description,
          price: parseInt(price, 10),
          stock: parseInt(stock, 10),
          categoryId: parsedCategory,
          images: imagePaths,
          shopId: shop.id,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: { product },
      });
    } catch (error) {
      console.error('❌ Error in POST /api/seller/products:', error);
      res.status(500).json({
        success: false,
        message: 'Internal Server Error',
      });
    }
  }
);

// =====================================================
// PUT /api/seller/products/:id
// =====================================================
/**
 * @swagger
 * /api/seller/products/{id}:
 *   put:
 *     summary: Update a product by ID
 *     tags: [Seller Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Product ID
 *         schema:
 *           type: integer
 *           example: 5
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: number
 *               categoryId:
 *                 type: integer
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       404:
 *         description: Product not found
 *       500:
 *         description: Internal Server Error
 */
router.put(
  '/products/:id',
  authenticateUser,
  upload.array('images', 5),
  async (req: any, res) => {
    console.log('➡️ [PUT] /api/seller/products/:id hit');

    try {
      const id = parseInt(req.params.id, 10);
      const { title, description, price, stock, categoryId } = req.body;

      const existing = await prisma.product.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        });
      }

      const imagePaths = req.files?.map((f: any) => f.path) ?? existing.images;

      const updated = await prisma.product.update({
        where: { id },
        data: {
          title: title ?? existing.title,
          description: description ?? existing.description,
          price: price ? parseInt(price, 10) : existing.price,
          stock: stock ? parseInt(stock, 10) : existing.stock,
          categoryId: categoryId
            ? parseInt(categoryId, 10)
            : existing.categoryId,
          images: imagePaths,
        },
      });

      res.json({
        success: true,
        message: 'Product updated',
        data: { product: updated },
      });
    } catch (err) {
      console.error('❌ Error in PUT /api/seller/products/:id:', err);
      res.status(500).json({
        success: false,
        message: 'Internal Server Error',
      });
    }
  }
);

// =====================================================
// DELETE /api/seller/products/:id
// =====================================================
/**
 * @swagger
 * /api/seller/products/{id}:
 *   delete:
 *     summary: Delete a product by ID
 *     tags: [Seller Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Product ID to delete
 *         schema:
 *           type: integer
 *           example: 7
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *       404:
 *         description: Product not found
 *       500:
 *         description: Internal Server Error
 */
router.delete('/products/:id', authenticateUser, async (req: any, res) => {
  console.log('➡️ [DELETE] /api/seller/products/:id hit');

  try {
    const id = parseInt(req.params.id, 10);
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    await prisma.product.delete({ where: { id } });
    res.json({
      success: true,
      message: 'Product deleted',
    });
  } catch (err) {
    console.error('❌ Error in DELETE /api/seller/products/:id:', err);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
    });
  }
});

export default router;
