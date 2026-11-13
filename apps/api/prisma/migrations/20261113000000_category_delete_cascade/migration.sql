ALTER TABLE "Transaction"
DROP CONSTRAINT "Transaction_categoryId_userId_fkey";

ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_categoryId_userId_fkey"
FOREIGN KEY ("categoryId", "userId")
REFERENCES "Category"("id", "userId")
ON DELETE CASCADE
ON UPDATE CASCADE;
