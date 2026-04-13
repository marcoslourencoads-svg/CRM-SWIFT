import {
  Controller,
  Post,
  Get,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ImportExportService } from './import-export.service';
import { CurrentOrg, CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

@Controller('leads')
export class ImportExportController {
  constructor(private readonly importExportService: ImportExportService) {}

  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter: (_req, file, cb) => {
        if (
          file.mimetype === 'text/csv' ||
          file.mimetype === 'application/vnd.ms-excel' ||
          file.originalname.endsWith('.csv')
        ) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only CSV files are accepted'), false);
        }
      },
    }),
  )
  async importLeads(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
    @Query('pipelineId') pipelineId: string,
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }
    if (!pipelineId) {
      throw new BadRequestException('pipelineId query parameter is required');
    }

    return this.importExportService.importCsv(
      orgId,
      user.sub,
      pipelineId,
      file.buffer,
    );
  }

  @Get('export')
  async exportLeads(
    @CurrentOrg() orgId: string,
    @Query('pipelineId') pipelineId?: string,
    @Query('statusId') statusId?: string,
    @Query('format') format?: string,
    @Res() res?: Response,
  ) {
    if (format && format !== 'csv') {
      throw new BadRequestException('Only CSV format is supported');
    }

    const csv = await this.importExportService.exportCsv(orgId, {
      pipelineId,
      statusId,
    });

    const filename = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;

    res!.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res!.send(csv);
  }
}
