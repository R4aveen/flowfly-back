import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    if (createUserDto.monthlyWorkHours <= 0) {
      throw new BadRequestException('monthlyWorkHours debe ser mayor que 0');
    }

    const hourlyWage = createUserDto.netMonthlyIncome / createUserDto.monthlyWorkHours;
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.userProfile.create({
        data: {
          email: createUserDto.email,
          password: hashedPassword,
          name: createUserDto.name,
          netMonthlyIncome: createUserDto.netMonthlyIncome,
          monthlyWorkHours: createUserDto.monthlyWorkHours,
          hourlyWage,
        },
      });

      await tx.salaryHistory.create({
        data: {
          userId: createdUser.id,
          baseNetIncome: createUserDto.netMonthlyIncome,
          monthlyWorkHours: createUserDto.monthlyWorkHours,
          hourlyWage,
        },
      });

      return createdUser;
    });

    const { password: _password, ...safeUser } = user;
    return safeUser;
  }

  findAll() {
    return `This action returns all users`;
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }

  findByEmail(email: string) {
    return this.prisma.userProfile.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.userProfile.findUnique({ where: { id } });
  }
}
