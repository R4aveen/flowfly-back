import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly usersService: UsersService,
	) {}

	@Post('register')
	register(@Body() signUpDto: CreateUserDto) {
		return this.usersService.create(signUpDto);
	}

	@Post('login')
	login(@Body() loginDto: LoginDto) {
		return this.authService.login(loginDto);
	}

	@Get('me')
	@UseGuards(JwtAuthGuard)
	getProfile(@CurrentUser() user: AuthUser) {
		return this.authService.getProfile(user.id);
	}
}
