/**
 * Database Configuration Module
 *
 * Modul ini menginisialisasi dan mengkonfigurasi koneksi database menggunakan Prisma ORM
 * dengan PostgreSQL adapter untuk performa optimal.
 *
 * @module db
 *
 * Features:
 * - Singleton pattern untuk menghindari multiple instances di development
 * - Connection pooling menggunakan pg Pool
 * - Prisma Adapter untuk PostgreSQL
 * - Environment-aware configuration
 *
 * @requires DATABASE_URL - Environment variable untuk connection string PostgreSQL
 * @throws {Error} Jika DATABASE_URL tidak ter-set
 *
 * @example
 * ```typescript
 * import { prisma } from '@/lib/db';
 *
 * // Query data
 * const users = await prisma.user.findMany();
 *
 * // Create data
 * const newUser = await prisma.user.create({
 *   data: { name: 'John Doe', email: 'john@example.com' }
 * });
 * ```
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg"; // PostgreSQL connection pool
import { PrismaClient } from "../../generated/prisma";

/**
 * Global type definition untuk menyimpan Prisma instance
 * Mencegah multiple instances saat hot reload di development
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Database connection string dari environment variables
 * Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
 */
const connectionString = process.env.DATABASE_URL;

/**
 * Prisma Client Instance (Singleton)
 *
 * - Di production: Membuat instance baru setiap kali
 * - Di development: Menggunakan global instance untuk menghindari connection limit
 *
 * Connection pooling dan adapter digunakan untuk:
 * - Meningkatkan performa query
 * - Mengelola koneksi database secara efisien
 * - Mendukung serverless environments
 *
 * @constant {PrismaClient}
 */
export const prisma =
  globalForPrisma.prisma ??
  (() => {
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    const pool = new Pool({ connectionString }); // Create a new PostgreSQL connection pool
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  })();

/**
 * Development mode: Simpan instance ke global object
 * Mencegah exhausted database connections saat hot reload
 */
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
