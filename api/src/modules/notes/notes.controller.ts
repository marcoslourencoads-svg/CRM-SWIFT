import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotesService } from './notes.service';
import { CreateNoteDto, UpdateNoteDto } from './dto/create-note.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class NotesController {
  constructor(private readonly service: NotesService) {}

  @Get('leads/:leadId/notes')
  findByLead(@Param('leadId') leadId: string) {
    return this.service.findByLead(leadId);
  }

  @Post('leads/:leadId/notes')
  create(
    @CurrentUser('sub') userId: string,
    @Param('leadId') leadId: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.service.create(leadId, userId, dto);
  }

  @Patch('notes/:id')
  update(@Param('id') id: string, @Body() dto: UpdateNoteDto) {
    return this.service.update(id, dto);
  }

  @Delete('notes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.softDelete(id);
  }
}
