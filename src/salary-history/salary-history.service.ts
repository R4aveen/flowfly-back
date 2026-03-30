import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChangeSalaryDto } from './dto/change-salary.dto';
import { CreateSalaryHistoryDto } from './dto/create-salary-history.dto';
import { UpdateSalaryHistoryDto } from './dto/update-salary-history.dto';

@Injectable()
export class SalaryHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly FAR_FUTURE_DATE = new Date('9999-12-31T23:59:59.999Z');

  private addUtcDays(date: Date, days: number) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  private toIsoDate(date: Date) {
    return `${date.getUTCFullYear().toString().padStart(4, '0')}-${(date.getUTCMonth() + 1)
      .toString()
      .padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')}`;
  }

  private toDmy(date: Date) {
    return `${date.getUTCDate().toString().padStart(2, '0')}-${(date.getUTCMonth() + 1)
      .toString()
      .padStart(2, '0')}-${date.getUTCFullYear()}`;
  }

  private normalizeDateInput(value: string, fieldName: string, bound: 'start' | 'end' | 'exact') {
    // Preferred format: dd-mm-yyyy.
    const dmyMatch = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
    if (dmyMatch) {
      const day = Number(dmyMatch[1]);
      const month = Number(dmyMatch[2]);
      const year = Number(dmyMatch[3]);
      const normalized = new Date(Date.UTC(year, month - 1, day));

      const isValidDate =
        normalized.getUTCFullYear() === year &&
        normalized.getUTCMonth() === month - 1 &&
        normalized.getUTCDate() === day;

      if (!isValidDate) {
        throw new BadRequestException(`${fieldName} invalida, usa formato dd-mm-yyyy`);
      }

      if (bound === 'end') {
        // Store endDate as exclusive bound to avoid precision and timezone gaps.
        const nextDay = this.addUtcDays(normalized, 1);
        return `${this.toIsoDate(nextDay)}T00:00:00.000Z`;
      }

      return `${this.toIsoDate(normalized)}T00:00:00.000Z`;
    }

    // Backward compatibility: accept YYYY-MM-DD.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      if (bound === 'end') {
        const normalized = new Date(`${value}T00:00:00.000Z`);
        const nextDay = this.addUtcDays(normalized, 1);
        return `${this.toIsoDate(nextDay)}T00:00:00.000Z`;
      }
      return `${value}T00:00:00.000Z`;
    }

    return value;
  }

  private parseDate(value?: string | null, fieldName = 'date', bound: 'start' | 'end' | 'exact' = 'exact') {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }

    value = this.normalizeDateInput(value, fieldName, bound);

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(
        `${fieldName} invalida, usa formato dd-mm-yyyy (preferido) o ISO 8601`,
      );
    }

    return parsed;
  }

  parseInputDate(value: string, fieldName = 'date', bound: 'start' | 'end' | 'exact' = 'exact') {
    const parsed = this.parseDate(value, fieldName, bound);
    if (!parsed) {
      throw new BadRequestException(`${fieldName} es requerida`);
    }
    return parsed;
  }

  private ensureWorkHours(monthlyWorkHours: number) {
    if (monthlyWorkHours <= 0) {
      throw new BadRequestException('monthlyWorkHours debe ser mayor que 0');
    }
  }

  private ensureDateRange(startDate: Date, endDate?: Date | null) {
    if (endDate && startDate >= endDate) {
      throw new BadRequestException('startDate debe ser menor que endDate');
    }
  }

  private calculateHourlyWage(baseNetIncome: number, monthlyWorkHours: number) {
    return baseNetIncome / monthlyWorkHours;
  }

  private async ensureNoOverlap(userId: string, startDate: Date, endDate?: Date | null, ignoreId?: string) {
    const nextEndDate = endDate ?? SalaryHistoryService.FAR_FUTURE_DATE;

    const overlap = await this.prisma.salaryHistory.findFirst({
      where: {
        userId,
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
        AND: [
          { startDate: { lt: nextEndDate } },
          { OR: [{ endDate: null }, { endDate: { gt: startDate } }] },
        ],
      },
    });

    if (overlap) {
      throw new BadRequestException('El periodo se superpone con otro salario historico');
    }
  }

  private async syncUserProfileCurrentSalary(userId: string) {
    const now = new Date();
    const currentSalary = await this.findSalaryAtDate(userId, now);

    if (!currentSalary) {
      return;
    }

    await this.prisma.userProfile.update({
      where: { id: userId },
      data: {
        netMonthlyIncome: currentSalary.baseNetIncome,
        monthlyWorkHours: currentSalary.monthlyWorkHours,
        hourlyWage: currentSalary.hourlyWage,
      },
    });
  }

  async create(userId: string, dto: CreateSalaryHistoryDto) {
    this.ensureWorkHours(dto.monthlyWorkHours);
    const startDate = this.parseDate(dto.startDate, 'startDate', 'start') ?? new Date();
    const endDate = this.parseDate(dto.endDate, 'endDate', 'end');
    this.ensureDateRange(startDate, endDate ?? undefined);
    await this.ensureNoOverlap(userId, startDate, endDate ?? undefined);

    const hourlyWage = this.calculateHourlyWage(dto.baseNetIncome, dto.monthlyWorkHours);

    const created = await this.prisma.salaryHistory.create({
      data: {
        userId,
        baseNetIncome: dto.baseNetIncome,
        monthlyWorkHours: dto.monthlyWorkHours,
        hourlyWage,
        startDate,
        endDate: endDate ?? null,
      },
    });

    await this.syncUserProfileCurrentSalary(userId);
    return created;
  }

  async createInitialSalaryHistory(userId: string, baseNetIncome: number, monthlyWorkHours: number) {
    this.ensureWorkHours(monthlyWorkHours);
    const hourlyWage = this.calculateHourlyWage(baseNetIncome, monthlyWorkHours);

    return this.prisma.salaryHistory.create({
      data: {
        userId,
        baseNetIncome,
        monthlyWorkHours,
        hourlyWage,
      },
    });
  }

  async changeCurrentSalary(userId: string, dto: ChangeSalaryDto) {
    this.ensureWorkHours(dto.monthlyWorkHours);

    const startDate = this.parseDate(dto.startDate, 'startDate', 'start') ?? new Date();

    const currentOpenSalary = await this.prisma.salaryHistory.findFirst({
      where: { userId, endDate: null },
      orderBy: { startDate: 'desc' },
    });

    if (currentOpenSalary && startDate < currentOpenSalary.startDate) {
      throw new BadRequestException(
        `startDate debe ser >= ${this.toDmy(currentOpenSalary.startDate)}`,
      );
    }

    const hourlyWage = this.calculateHourlyWage(dto.baseNetIncome, dto.monthlyWorkHours);

    const salaryVersion = await this.prisma.$transaction(async (tx) => {
      if (currentOpenSalary && startDate.getTime() === currentOpenSalary.startDate.getTime()) {
        return tx.salaryHistory.update({
          where: { id: currentOpenSalary.id },
          data: {
            baseNetIncome: dto.baseNetIncome,
            monthlyWorkHours: dto.monthlyWorkHours,
            hourlyWage,
          },
        });
      }

      await tx.salaryHistory.updateMany({
        where: { userId, endDate: null },
        data: { endDate: startDate },
      });

      return tx.salaryHistory.create({
        data: {
          userId,
          baseNetIncome: dto.baseNetIncome,
          monthlyWorkHours: dto.monthlyWorkHours,
          hourlyWage,
          startDate,
        },
      });
    });

    await this.syncUserProfileCurrentSalary(userId);
    return salaryVersion;
  }

  async findOne(userId: string, id: string) {
    const salaryVersion = await this.prisma.salaryHistory.findFirst({
      where: { id, userId },
    });

    if (!salaryVersion) {
      throw new NotFoundException('Registro de salario no encontrado');
    }

    return salaryVersion;
  }

  findCurrentSalary(userId: string) {
    return this.prisma.salaryHistory.findFirst({
      where: { userId, endDate: null },
      orderBy: { startDate: 'desc' },
    });
  }

  findHistory(userId: string) {
    return this.prisma.salaryHistory.findMany({
      where: { userId },
      orderBy: { startDate: 'desc' },
    });
  }

  findSalaryAtDate(userId: string, date: Date) {
    return this.prisma.salaryHistory.findFirst({
      where: {
        userId,
        startDate: { lte: date },
        OR: [{ endDate: null }, { endDate: { gt: date } }],
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async findSalaryAtDateOrThrow(userId: string, date: Date) {
    const salary = await this.findSalaryAtDate(userId, date);
    if (!salary) {
      throw new NotFoundException('No hay salario configurado para esa fecha');
    }

    return salary;
  }

  async update(userId: string, id: string, dto: UpdateSalaryHistoryDto) {
    const current = await this.findOne(userId, id);

    const baseNetIncome = dto.baseNetIncome ?? Number(current.baseNetIncome);
    const monthlyWorkHours = dto.monthlyWorkHours ?? current.monthlyWorkHours;
    this.ensureWorkHours(monthlyWorkHours);

    const startDate = this.parseDate(dto.startDate, 'startDate', 'start') ?? current.startDate;
    const endDate = dto.endDate === undefined ? current.endDate : this.parseDate(dto.endDate, 'endDate', 'end');

    this.ensureDateRange(startDate, endDate ?? undefined);
    await this.ensureNoOverlap(userId, startDate, endDate ?? undefined, id);

    const hourlyWage = this.calculateHourlyWage(baseNetIncome, monthlyWorkHours);

    const updated = await this.prisma.salaryHistory.update({
      where: { id },
      data: {
        baseNetIncome,
        monthlyWorkHours,
        hourlyWage,
        startDate,
        endDate: endDate ?? null,
      },
    });

    await this.syncUserProfileCurrentSalary(userId);
    return updated;
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    await this.prisma.salaryHistory.delete({ where: { id } });
    await this.syncUserProfileCurrentSalary(userId);

    return { deleted: true };
  }
}
