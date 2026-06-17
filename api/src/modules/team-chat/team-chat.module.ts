import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TeamChatController } from './team-chat.controller';
import { TeamChatService } from './team-chat.service';
import { TeamChatPublisher } from './team-chat.publisher';

@Module({
  imports: [JwtModule.register({})],
  controllers: [TeamChatController],
  providers: [TeamChatService, TeamChatPublisher],
  exports: [TeamChatService],
})
export class TeamChatModule {}
