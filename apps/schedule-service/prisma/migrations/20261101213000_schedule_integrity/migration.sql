-- Preserve appointment history when a customer or doctor is removed.
ALTER TABLE "Schedule"
  DROP CONSTRAINT "Schedule_customerID_fkey",
  ADD CONSTRAINT "Schedule_customerID_fkey"
    FOREIGN KEY ("customerID") REFERENCES "Customer"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Schedule"
  DROP CONSTRAINT "Schedule_doctorID_fkey",
  ADD CONSTRAINT "Schedule_doctorID_fkey"
    FOREIGN KEY ("doctorID") REFERENCES "Doctor"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- A doctor can have at most one appointment at an exact time. The database
-- constraint also protects against simultaneous requests racing each other.
CREATE UNIQUE INDEX "Schedule_doctorID_scheduleAt_key"
  ON "Schedule"("doctorID", "scheduleAt");
