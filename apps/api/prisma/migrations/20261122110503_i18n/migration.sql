-- AlterTable
ALTER TABLE "Position" ADD COLUMN     "titleBn" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'bn';
