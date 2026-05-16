import { Module } from '@nestjs/common';
import { TeamChatController } from './team-chat.controller';
import { TeamChatService } from './team-chat.service';
import { TeamChatPublisher } from './team-chat.publisher';

@Module({
  controllers: [TeamChatController],
  providers: [TeamChatService, TeamChatPublisher],
  exports: [TeamChatService],
})
export class TeamChatModule {}
