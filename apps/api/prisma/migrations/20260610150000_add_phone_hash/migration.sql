-- AlterTable
ALTER TABLE "User" ADD COLUMN "phoneHash" TEXT;

-- DropIndex (existing unique constraint on plaintext phone)
DROP INDEX IF EXISTS "User_phone_key";

-- CreateIndex (stable lookup via hash, still unique)
CREATE UNIQUE INDEX "User_phoneHash_key" ON "User"("phoneHash");
