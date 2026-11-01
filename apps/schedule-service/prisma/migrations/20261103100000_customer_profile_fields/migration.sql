CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'WAITING', 'COMPLETED');

ALTER TABLE "Customer"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "gender" TEXT,
  ADD COLUMN "birthDate" DATE,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "treatment" TEXT,
  ADD COLUMN "status" "CustomerStatus",
  ADD COLUMN "nextVisit" TIMESTAMPTZ(3),
  ADD COLUMN "note" TEXT;
