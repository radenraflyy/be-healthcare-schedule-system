CREATE TABLE "ClinicWorkflow" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "steps" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClinicWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClinicWorkflow_userId_key" ON "ClinicWorkflow"("userId");
