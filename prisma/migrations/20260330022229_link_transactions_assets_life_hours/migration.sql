-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "assetId" TEXT,
ADD COLUMN     "lifeHoursCost" DECIMAL(10,2);

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
