import { EntropyRiskLevel, TransactionType } from '@prisma/client';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateTransactionDto {
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsOptional()
  @IsEnum(EntropyRiskLevel)
  category?: EntropyRiskLevel;

  @IsString()
  @MinLength(2)
  description: string;

  @IsOptional()
  @IsString()
  date?: string;
}
