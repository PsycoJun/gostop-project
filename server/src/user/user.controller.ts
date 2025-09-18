// gostop-project/server/src/user/user.controller.ts

import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth') // 👈 이 부분이 '/auth' 경로를 책임지게 됩니다.
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register') // 👈 'POST /auth/register' 요청을 이 함수가 처리합니다.
  async register(@Body() createUserDto: CreateUserDto) {
    return this.userService.register(createUserDto);
  }

  @Post('login') // 👈 'POST /auth/login' 요청을 이 함수가 처리합니다.
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.userService.login(loginDto);
  }
}