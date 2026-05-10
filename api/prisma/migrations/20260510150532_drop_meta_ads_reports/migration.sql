/*
  Warnings:

  - You are about to drop the `meta_ad_accounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `meta_reports` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "meta_reports" DROP CONSTRAINT "meta_reports_account_id_fkey";

-- DropTable
DROP TABLE "meta_ad_accounts";

-- DropTable
DROP TABLE "meta_reports";

-- DropEnum
DROP TYPE "MetaReportChannel";
