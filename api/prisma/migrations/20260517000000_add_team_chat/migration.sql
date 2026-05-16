-- CreateEnum
CREATE TYPE "TeamChannelType" AS ENUM ('PUBLIC', 'PRIVATE', 'DIRECT');

-- CreateTable
CREATE TABLE "team_channels" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TeamChannelType" NOT NULL DEFAULT 'PUBLIC',
    "description" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "team_channel_members" (
    "channel_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_read_at" TIMESTAMP(3),

    CONSTRAINT "team_channel_members_pkey" PRIMARY KEY ("channel_id", "user_id")
);

CREATE TABLE "team_messages" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_channels_organization_id_idx" ON "team_channels"("organization_id");
CREATE INDEX "team_channel_members_user_id_idx" ON "team_channel_members"("user_id");
CREATE INDEX "team_messages_channel_id_created_at_idx" ON "team_messages"("channel_id", "created_at");

-- AddForeignKey
ALTER TABLE "team_channels" ADD CONSTRAINT "team_channels_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_channel_members" ADD CONSTRAINT "team_channel_members_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "team_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "team_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
