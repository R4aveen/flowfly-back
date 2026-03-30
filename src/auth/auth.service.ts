import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
	constructor(
		private readonly usersService: UsersService,
		private readonly jwtService: JwtService,
	) {}

	async login(loginDto: LoginDto) {
		const user = await this.usersService.findByEmail(loginDto.email);
		if (!user) {
			throw new UnauthorizedException('Credenciales invalidas');
		}

		const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
		if (!isPasswordValid) {
			throw new UnauthorizedException('Credenciales invalidas');
		}

		const payload = { sub: user.id, email: user.email };

		return {
			access_token: await this.jwtService.signAsync(payload),
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				hourlyWage: user.hourlyWage,
			},
		};
	}

	async getProfile(userId: string) {
		const user = await this.usersService.findById(userId);
		if (!user) {
			throw new UnauthorizedException('Usuario no encontrado');
		}

		return {
			id: user.id,
			email: user.email,
			name: user.name,
			hourlyWage: user.hourlyWage,
		};
	}
}
