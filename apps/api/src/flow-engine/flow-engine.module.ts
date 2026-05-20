import { Module } from '@nestjs/common';
import { FlowEngineService } from './flow-engine.service';
import { FlowEngineController } from './flow-engine.controller';

@Module({
  controllers: [FlowEngineController],
  providers: [FlowEngineService],
  exports: [FlowEngineService],
})
export class FlowEngineModule {}
