import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateSalaryHistoryDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  baseNetIncome?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  monthlyWorkHours?: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string | null;
}
