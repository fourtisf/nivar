// Prisma client singleton. The generated client lives in ../generated/client
// (run `npm run prisma:generate`). We re-export a shared instance so the api
// reuses one connection pool.
import { PrismaClient } from "../generated/client/index.js";

declare global {
  // eslint-disable-next-line no-var
  var __nivarPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__nivarPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalThis.__nivarPrisma = prisma;

export * from "../generated/client/index.js";
export default prisma;
