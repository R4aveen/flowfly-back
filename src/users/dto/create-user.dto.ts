import { IsEmail, IsInt, IsNumber, IsString, Min, MinLength } from 'class-validator';

export class CreateUserDto {
	@IsEmail()
	email: string;

	@IsString()
	@MinLength(8)
	password: string;

	@IsString()
	@MinLength(2)
	name: string;

	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	netMonthlyIncome: number;

	@IsInt()
	@Min(1)
	monthlyWorkHours: number;
}
