import { Module } from '@nestjs/common';
import { SalaryHistoryService } from './salary-history.service';
import { SalaryHistoryController } from './salary-history.controller';

@Module({
  providers: [SalaryHistoryService],
  controllers: [SalaryHistoryController],
  exports: [SalaryHistoryService],
})
export class SalaryHistoryModule {}
