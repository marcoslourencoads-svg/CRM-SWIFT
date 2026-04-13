-- CreateTable
CREATE TABLE "pipelines" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_statuses" (
    "id" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "is_won" BOOLEAN NOT NULL DEFAULT false,
    "is_mql" BOOLEAN NOT NULL DEFAULT false,
    "is_meeting" BOOLEAN NOT NULL DEFAULT false,
    "stale_after_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transition_rules" (
    "id" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,
    "from_status_id" TEXT NOT NULL,
    "to_status_id" TEXT NOT NULL,
    "is_allowed" BOOLEAN NOT NULL DEFAULT true,
    "required_fields" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transition_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pipelines_organization_id_deleted_at_idx" ON "pipelines"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "pipeline_statuses_pipeline_id_position_idx" ON "pipeline_statuses"("pipeline_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "transition_rules_pipeline_id_from_status_id_to_status_id_key" ON "transition_rules"("pipeline_id", "from_status_id", "to_status_id");

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_statuses" ADD CONSTRAINT "pipeline_statuses_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transition_rules" ADD CONSTRAINT "transition_rules_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transition_rules" ADD CONSTRAINT "transition_rules_from_status_id_fkey" FOREIGN KEY ("from_status_id") REFERENCES "pipeline_statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transition_rules" ADD CONSTRAINT "transition_rules_to_status_id_fkey" FOREIGN KEY ("to_status_id") REFERENCES "pipeline_statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
