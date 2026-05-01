import { Module } from '@nestjs/common';
import { AdminSchemaController } from './admin-schema.controller';

@Module({
  controllers: [AdminSchemaController],
})
export class AdminModule {}
