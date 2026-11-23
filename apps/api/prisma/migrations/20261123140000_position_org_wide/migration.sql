-- AlterTable
ALTER TABLE "Position" ADD COLUMN "orgWide" BOOLEAN NOT NULL DEFAULT false;

-- The two top positions are not part of any department or secretariat.
UPDATE "Position" SET "orgWide" = true WHERE "title" IN ('Director', 'Assistant Director');
