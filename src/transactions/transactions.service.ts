import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntropyRiskLevel, Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  private parseDate(value?: string) {
    if (!value) {
      return new Date();
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('date invalida, usa formato ISO 8601');
    }

    return parsed;
  }

  private calculateAssetAdjustment(type: TransactionType, amount: number) {
    return type === TransactionType.INCOME ? amount : -amount;
  }

  private async getSalaryAtDate(tx: Prisma.TransactionClient, userId: string, date: Date) {
    return tx.salaryHistory.findFirst({
      where: {
        userId,
        startDate: { lte: date },
        OR: [{ endDate: null }, { endDate: { gt: date } }],
      },
      orderBy: { startDate: 'desc' },
    });
  }

  private async ensureAssetOwnership(tx: Prisma.TransactionClient, userId: string, assetId: string) {
    const asset = await tx.asset.findFirst({ where: { id: assetId, userId } });
    if (!asset) {
      throw new NotFoundException('Asset no encontrado para este usuario');
    }

    return asset;
  }

  private computeLifeHoursCost(amount: number, hourlyWage: number) {
    if (hourlyWage <= 0) {
      return null;
    }

    return amount / hourlyWage;
  }

  async create(userId: string, createDto: CreateTransactionDto) {
    const date = this.parseDate(createDto.date);

    return this.prisma.$transaction(async (tx) => {
      const salaryAtDate = await this.getSalaryAtDate(tx, userId, date);
      const hourlyWage = salaryAtDate ? Number(salaryAtDate.hourlyWage) : 0;
      const lifeHoursCost = this.computeLifeHoursCost(createDto.amount, hourlyWage);

      if (createDto.assetId) {
        await this.ensureAssetOwnership(tx, userId, createDto.assetId);
      }

      const transaction = await tx.transaction.create({
        data: {
          userId,
          assetId: createDto.assetId,
          amount: createDto.amount,
          type: createDto.type,
          category: createDto.category ?? EntropyRiskLevel.LOW,
          description: createDto.description,
          lifeHoursCost,
          date,
        },
      });

      if (createDto.assetId) {
        await tx.asset.update({
          where: { id: createDto.assetId },
          data: {
            balance: {
              increment: this.calculateAssetAdjustment(createDto.type, createDto.amount),
            },
          },
        });
      }

      return transaction;
    });
  }

  findAll(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const transaction = await this.prisma.transaction.findFirst({ where: { id, userId } });
    if (!transaction) {
      throw new NotFoundException('Transaccion no encontrada');
    }

    return transaction;
  }

  async update(userId: string, id: string, updateDto: UpdateTransactionDto) {
    const current = await this.findOne(userId, id);

    const nextAmount = updateDto.amount ?? Number(current.amount);
    const nextType = updateDto.type ?? current.type;
    const nextCategory = updateDto.category ?? current.category;
    const nextDescription = updateDto.description ?? current.description;
    const nextDate = updateDto.date ? this.parseDate(updateDto.date) : current.date;

    const nextAssetId = Object.prototype.hasOwnProperty.call(updateDto, 'assetId')
      ? updateDto.assetId ?? null
      : current.assetId;

    return this.prisma.$transaction(async (tx) => {
      if (current.assetId) {
        await tx.asset.update({
          where: { id: current.assetId },
          data: {
            balance: {
              increment: this.calculateAssetAdjustment(current.type, -Number(current.amount)),
            },
          },
        });
      }

      if (nextAssetId) {
        await this.ensureAssetOwnership(tx, userId, nextAssetId);
      }

      const salaryAtDate = await this.getSalaryAtDate(tx, userId, nextDate);
      const hourlyWage = salaryAtDate ? Number(salaryAtDate.hourlyWage) : 0;
      const lifeHoursCost = this.computeLifeHoursCost(nextAmount, hourlyWage);

      const updated = await tx.transaction.update({
        where: { id },
        data: {
          assetId: nextAssetId,
          amount: nextAmount,
          type: nextType,
          category: nextCategory,
          description: nextDescription,
          lifeHoursCost,
          date: nextDate,
        },
      });

      if (nextAssetId) {
        await tx.asset.update({
          where: { id: nextAssetId },
          data: {
            balance: {
              increment: this.calculateAssetAdjustment(nextType, nextAmount),
            },
          },
        });
      }

      return updated;
    });
  }

  async remove(userId: string, id: string) {
    const current = await this.findOne(userId, id);

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.delete({ where: { id } });

      if (current.assetId) {
        await tx.asset.update({
          where: { id: current.assetId },
          data: {
            balance: {
              increment: this.calculateAssetAdjustment(current.type, -Number(current.amount)),
            },
          },
        });
      }
    });

    return { deleted: true };
  }
}
