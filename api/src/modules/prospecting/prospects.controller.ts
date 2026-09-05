import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ProspectStage, ProspectChannel } from '@prisma/client';
import { ProspectsService } from './prospects.service';
import { ProspectImportService } from './prospect-import.service';
import { CurrentOrg, CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import {
  CreateProspectDto,
  UpdateProspectDto,
  RegisterTouchDto,
  ChangeStageDto,
  ConvertProspectDto,
  BulkProspectDto,
  UpsertProspectNoteDto,
} from './dto/prospect.dto';

@Controller('prospects')
export class ProspectsController {
  constructor(
    private readonly service: ProspectsService,
    private readonly importService: ProspectImportService,
  ) {}

  // ── Rotas fixas antes das que usam :id, senão "queue" e "bulk"
  //    seriam lidos como id (mesma pegadinha de leads.controller.ts).

  @Get()
  findAll(
    @CurrentOrg() orgId: string,
    @Query('stage') stage?: ProspectStage,
    @Query('ownerId') ownerId?: string,
    @Query('listId') listId?: string,
    @Query('channel') channel?: ProspectChannel,
    @Query('hasAds') hasAds?: string,
    @Query('niche') niche?: string,
    @Query('search') search?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(orgId, {
      stage,
      ownerId,
      listId,
      channel,
      niche,
      search,
      cursor,
      ...(hasAds !== undefined ? { hasAds: hasAds === 'true' } : {}),
      ...(limit ? { limit: parseInt(limit, 10) } : {}),
    });
  }

  @Get('queue')
  getQueue(
    @CurrentOrg() orgId: string,
    @Query('ownerId') ownerId?: string,
    @Query('tzOffset') tzOffset?: string,
  ) {
    const offset = tzOffset !== undefined ? parseInt(tzOffset, 10) : undefined;
    return this.service.getQueue(
      orgId,
      ownerId,
      Number.isFinite(offset) ? offset : undefined,
    );
  }

  @Get('agenda')
  getAgenda(
    @CurrentOrg() orgId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('ownerId') ownerId?: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException('from e to sao obrigatorios');
    }
    return this.service.getAgenda(orgId, from, to, ownerId);
  }

  @Get('export')
  async exportCsv(
    @CurrentOrg() orgId: string,
    @Res() res: Response,
    @Query('listId') listId?: string,
  ) {
    const csv = await this.importService.exportCsv(orgId, listId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="prospeccao.csv"');
    res.send(csv);
  }

  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (
          file.mimetype === 'text/csv' ||
          file.mimetype === 'application/vnd.ms-excel' ||
          file.originalname.endsWith('.csv')
        ) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Apenas arquivos CSV sao aceitos'), false);
        }
      },
    }),
  )
  importCsv(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
    @Query('listId') listId?: string,
  ) {
    if (!file) throw new BadRequestException('Arquivo CSV e obrigatorio');
    return this.importService.importCsv(orgId, user.sub, file.buffer, listId);
  }

  @Patch('bulk/assign')
  bulkAssign(@CurrentOrg() orgId: string, @Body() dto: BulkProspectDto) {
    return this.service.bulkAssign(orgId, dto);
  }

  @Patch('bulk/list')
  bulkList(@CurrentOrg() orgId: string, @Body() dto: BulkProspectDto) {
    return this.service.bulkList(orgId, dto);
  }

  @Patch('bulk/stage')
  bulkStage(@CurrentOrg() orgId: string, @Body() dto: BulkProspectDto) {
    return this.service.bulkStage(orgId, dto);
  }

  @Patch('bulk/delete')
  bulkDelete(@CurrentOrg() orgId: string, @Body() dto: BulkProspectDto) {
    return this.service.bulkDelete(orgId, dto);
  }

  @Post()
  create(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateProspectDto,
  ) {
    return this.service.create(orgId, user.sub, dto);
  }

  @Get(':id')
  findOne(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.findOne(orgId, id);
  }

  @Patch(':id')
  update(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProspectDto,
  ) {
    return this.service.update(orgId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.remove(orgId, id);
  }

  @Post(':id/touches')
  registerTouch(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: RegisterTouchDto,
  ) {
    return this.service.registerTouch(orgId, user.sub, id, dto);
  }

  @Patch(':id/stage')
  changeStage(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Body() dto: ChangeStageDto,
  ) {
    return this.service.changeStage(orgId, id, dto);
  }

  @Post(':id/notes')
  addNote(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpsertProspectNoteDto,
  ) {
    return this.service.addNote(orgId, user.sub, id, dto);
  }

  @Post(':id/convert')
  convert(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ConvertProspectDto,
  ) {
    return this.service.convert(orgId, user.sub, id, dto);
  }
}
