-- CreateTable
CREATE TABLE "pipeline_memberships" (
    "id" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "can_edit" BOOLEAN NOT NULL DEFAULT true,
    "can_see_all_leads" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_memberships_pipeline_id_user_id_key" ON "pipeline_memberships"("pipeline_id", "user_id");

-- CreateIndex
CREATE INDEX "pipeline_memberships_user_id_idx" ON "pipeline_memberships"("user_id");

-- AddForeignKey
ALTER TABLE "pipeline_memberships" ADD CONSTRAINT "pipeline_memberships_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
