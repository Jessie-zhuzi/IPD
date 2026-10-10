-- AlterTable
ALTER TABLE `PointsLedger` ADD COLUMN `dedupeKey` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `PointsLedger_dedupeKey_key` ON `PointsLedger`(`dedupeKey`);

