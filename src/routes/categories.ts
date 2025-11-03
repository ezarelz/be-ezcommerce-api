import { Router, type Request, type Response } from 'express';
import prisma from '../libs/prisma';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Public product categories
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: "Fashion"
 *         slug:
 *           type: string
 *           example: "fashion"
 *     CategoriesResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "OK"
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Category'
 *     ServerError:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Internal Server Error"
 */

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all product categories (auto-seeds base categories if missing)
 *     description: >
 *       Automatically ensures base categories exist with default slugs:
 *       **fashion**, **electronics**, and **others**.
 *       Returns all categories ordered by ascending ID.
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Successfully fetched categories
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoriesResponse'
 *             examples:
 *               success:
 *                 summary: Example successful response
 *                 value:
 *                   success: true
 *                   message: "OK"
 *                   data:
 *                     - id: 1
 *                       name: "Fashion"
 *                       slug: "fashion"
 *                     - id: 2
 *                       name: "Electronics"
 *                       slug: "electronics"
 *                     - id: 3
 *                       name: "Others"
 *                       slug: "others"
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServerError'
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const defaults = [
      { name: 'Fashion', slug: 'fashion' },
      { name: 'Electronics', slug: 'electronics' },
      { name: 'Others', slug: 'others' },
    ];

    // ✅ Upsert by unique slug (safe for Postgres auto-increment IDs)
    await Promise.all(
      defaults.map((c) =>
        prisma.category.upsert({
          where: { slug: c.slug },
          update: { name: c.name },
          create: c,
        })
      )
    );

    const categories = await prisma.category.findMany({
      orderBy: { id: 'asc' },
    });

    res.status(200).json({
      success: true,
      message: 'OK',
      data: categories,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
    });
  }
});

export default router;
