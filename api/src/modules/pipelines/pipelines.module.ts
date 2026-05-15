import { Module } from '@nestjs/common';
import { PipelinesService } from './pipelines.service';
import { PipelinesController } from './pipelines.controller';
import { PipelinePermissionsService } from './pipeline-permissions.service';
import { PipelinePermissionsController } from './pipeline-permissions.controller';

@Module({
  controllers: [PipelinesController, PipelinePermissionsController],
  providers: [PipelinesService, PipelinePermissionsService],
  exports: [PipelinesService, PipelinePermissionsService],
})
export class PipelinesModule {}
