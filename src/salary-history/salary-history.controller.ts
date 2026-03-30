import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { ChangeSalaryDto } from './dto/change-salary.dto';
import { CreateSalaryHistoryDto } from './dto/create-salary-history.dto';
import { SalaryHistoryService } from './salary-history.service';
import { UpdateSalaryHistoryDto } from './dto/update-salary-history.dto';

@Controller('salary-history')
@UseGuards(JwtAuthGuard)
export class SalaryHistoryController {
  constructor(private readonly salaryHistoryService: SalaryHistoryService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSalaryHistoryDto) {
    return this.salaryHistoryService.create(user.id, dto);
  }

  @Get()
  getHistory(@CurrentUser() user: AuthUser) {
    return this.salaryHistoryService.findHistory(user.id);
  }

  @Get('current')
  getCurrent(@CurrentUser() user: AuthUser) {
    return this.salaryHistoryService.findCurrentSalary(user.id);
  }

  @Get('at')
  getAtDate(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    if (!date) {
      throw new BadRequestException('date es requerida, formato dd-mm-yyyy');
    }

    const parsedDate = this.salaryHistoryService.parseInputDate(date, 'date');

    return this.salaryHistoryService.findSalaryAtDateOrThrow(user.id, parsedDate);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.salaryHistoryService.findOne(user.id, id);
  }

  @Post('change')
  changeSalary(@CurrentUser() user: AuthUser, @Body() dto: ChangeSalaryDto) {
    return this.salaryHistoryService.changeCurrentSalary(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSalaryHistoryDto) {
    return this.salaryHistoryService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.salaryHistoryService.remove(user.id, id);
  }
}
