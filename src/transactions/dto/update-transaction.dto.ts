import { EntropyRiskLevel, TransactionType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class UpdateTransactionDto {
  @IsOptional()
  @IsUUID()
  assetId?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsEnum(EntropyRiskLevel)
  category?: EntropyRiskLevel;

  @IsOptional()
  @IsString()
  @MinLength(2)
  description?: string;

  @IsOptional()
  @IsString()
  date?: string;
}
