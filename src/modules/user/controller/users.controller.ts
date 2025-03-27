import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
  createUserSchema,
  updateUserSchema,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(createUserSchema)) createUserDto: CreateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.create(createUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(): Promise<UserResponseDto[]> {
    return this.usersService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.findById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.usersService.remove(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Param('id') id: string,
    @Body() payload: { currentPassword: string; newPassword: string },
  ): Promise<void> {
    return this.usersService.updatePassword(
      id,
      payload.currentPassword,
      payload.newPassword,
    );
  }
}
