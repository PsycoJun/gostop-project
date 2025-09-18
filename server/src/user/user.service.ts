import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async register(createUserDto: CreateUserDto) {
    const { username, password } = createUserDto;

    const existingUser = await this.userModel.findOne({ username }).exec();
    if (existingUser) {
      throw new ConflictException('이미 존재하는 사용자 이름입니다.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new this.userModel({ username, password: hashedPassword });
    await newUser.save();

    return { message: '회원가입이 성공적으로 완료되었습니다.' };
  }

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;
    const user = await this.userModel.findOne({ username }).exec();

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('아이디 또는 비밀번호가 잘못되었습니다.');
    }

    const payload = { userId: user.id.toString(), username: user.username };
    const accessToken = this.jwtService.sign(payload);

    return {
      message: '로그인 성공!',
      accessToken,
    };
  }
}