ALTER TABLE "Schedule"
  ADD COLUMN "durationMinutes" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "cancelReason" TEXT;
ALTER TABLE "Schedule"
  ADD CONSTRAINT "Schedule_durationMinutes_check"
  CHECK ("durationMinutes" BETWEEN 5 AND 240);
ALTER TABLE "Schedule"
  ALTER COLUMN "scheduleAt" TYPE TIMESTAMPTZ(3)
  USING "scheduleAt" AT TIME ZONE 'UTC';

ALTER TABLE "Customer" ADD COLUMN "userId" UUID;
ALTER TABLE "Doctor" ADD COLUMN "userId" UUID;
CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");
CREATE UNIQUE INDEX "Doctor_userId_key" ON "Doctor"("userId");

DROP INDEX "Schedule_doctorID_scheduleAt_key";
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE INDEX "Schedule_doctorID_status_scheduleAt_idx"
  ON "Schedule"("doctorID", "status", "scheduleAt");

-- timestamptz + interval is STABLE (timezone/DST dependent), so it cannot be
-- used in an exclusion index expression. Serialize writes per doctor and check
-- the interval overlap in a trigger instead. The doctor-row lock prevents two
-- concurrent bookings for the same doctor from both passing the check.
CREATE FUNCTION "enforce_schedule_no_time_overlap"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."status" <> 'CANCELLED' THEN
    PERFORM 1 FROM "Doctor" WHERE "id" = NEW."doctorID" FOR UPDATE;

    IF EXISTS (
      SELECT 1
      FROM "Schedule" AS existing
      WHERE existing."doctorID" = NEW."doctorID"
        AND existing."id" <> NEW."id"
        AND existing."status" <> 'CANCELLED'
        AND existing."scheduleAt" < NEW."scheduleAt" + (NEW."durationMinutes" * INTERVAL '1 minute')
        AND NEW."scheduleAt" < existing."scheduleAt" + (existing."durationMinutes" * INTERVAL '1 minute')
    ) THEN
      RAISE EXCEPTION 'Doctor already has an overlapping appointment.'
        USING ERRCODE = '23P01';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Schedule_no_time_overlap_trigger"
BEFORE INSERT OR UPDATE OF "doctorID", "scheduleAt", "durationMinutes", "status"
ON "Schedule"
FOR EACH ROW
EXECUTE FUNCTION "enforce_schedule_no_time_overlap"();

CREATE TABLE "DoctorAvailability" (
  "id" UUID NOT NULL,
  "doctorId" UUID NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "slotMinutes" INTEGER NOT NULL DEFAULT 30,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DoctorAvailability_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DoctorAvailability_dayOfWeek_check" CHECK ("dayOfWeek" BETWEEN 0 AND 6),
  CONSTRAINT "DoctorAvailability_time_check" CHECK (
    "startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute"
  ),
  CONSTRAINT "DoctorAvailability_slot_check" CHECK ("slotMinutes" BETWEEN 5 AND 240)
);

CREATE INDEX "DoctorAvailability_doctorId_dayOfWeek_idx"
  ON "DoctorAvailability"("doctorId", "dayOfWeek");
ALTER TABLE "DoctorAvailability"
  ADD CONSTRAINT "DoctorAvailability_time_overlap_excl"
  EXCLUDE USING gist (
    "doctorId" WITH =,
    "dayOfWeek" WITH =,
    int4range("startMinute", "endMinute", '[)') WITH &&
  );
ALTER TABLE "DoctorAvailability"
  ADD CONSTRAINT "DoctorAvailability_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'CANCELLED');
CREATE TABLE "ScheduleReminder" (
  "id" UUID NOT NULL,
  "scheduleId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "remindAt" TIMESTAMPTZ(3) NOT NULL,
  "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
  "sentAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduleReminder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScheduleReminder_scheduleId_fkey" FOREIGN KEY ("scheduleId")
    REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ScheduleReminder_scheduleId_kind_key"
  ON "ScheduleReminder"("scheduleId", "kind");
CREATE INDEX "ScheduleReminder_status_remindAt_idx"
  ON "ScheduleReminder"("status", "remindAt");

CREATE TABLE "Notification" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "scheduleId" UUID,
  "sourceReminderId" UUID,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMPTZ(3),
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Notification_sourceReminderId_key"
  ON "Notification"("sourceReminderId");
CREATE INDEX "Notification_userId_createdAt_idx"
  ON "Notification"("userId", "createdAt");
