import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SalaryHistoryModule } from './salary-history/salary-history.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule, SalaryHistoryModule, TransactionsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
