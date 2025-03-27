import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto';
import * as argon2 from 'argon2';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Transformar usuário do DB para DTO de resposta
  private mapUserToDto(user: User): UserResponseDto {
    const { passwordHash, ...userData } = user;
    return userData as unknown as UserResponseDto;
  }

  // Criar um novo usuário
  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const { email, password, firstName, lastName } = createUserDto;

    // Verificar se email já está em uso
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email já está em uso');
    }

    try {
      // Hash da senha usando argon2 (mais seguro que bcrypt)
      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id, // Variante mais recomendada
        memoryCost: 65536, // 64 MB
        timeCost: 3, // 3 iterações
        parallelism: 4, // 4 threads
      });

      // Criar usuário no banco de dados
      const newUser = await this.prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          passwordHash,
        },
      });

      this.logger.log(`Usuário criado com sucesso: ${newUser.id}`);
      return this.mapUserToDto(newUser);
    } catch (error) {
      this.logger.error(`Erro ao criar usuário: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Buscar todos os usuários
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.prisma.user.findMany();
    return users.map((user) => this.mapUserToDto(user));
  }

  // Buscar usuário por ID
  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`Usuário com ID ${id} não encontrado`);
    }

    return this.mapUserToDto(user);
  }

  // Buscar usuário por email
  async findByEmail(email: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException(`Usuário com email ${email} não encontrado`);
    }

    return user;
  }

  // Atualizar usuário
  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    // Verificar se usuário existe
    await this.findById(id);

    // Se email está sendo atualizado, verificar se já está em uso
    if (updateUserDto.email) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          email: updateUserDto.email,
          id: { not: id },
        },
      });

      if (existingUser) {
        throw new ConflictException('Email já está em uso');
      }
    }

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: updateUserDto,
      });

      this.logger.log(`Usuário atualizado com sucesso: ${id}`);
      return this.mapUserToDto(updatedUser);
    } catch (error) {
      this.logger.error(
        `Erro ao atualizar usuário: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Remover usuário
  async remove(id: string): Promise<void> {
    // Verificar se usuário existe
    await this.findById(id);

    try {
      await this.prisma.user.delete({
        where: { id },
      });
      this.logger.log(`Usuário removido com sucesso: ${id}`);
    } catch (error) {
      this.logger.error(
        `Erro ao remover usuário: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Verificar senha
  async verifyPassword(user: User, password: string): Promise<boolean> {
    try {
      return await argon2.verify(user.passwordHash, password);
    } catch (error) {
      this.logger.error(
        `Erro ao verificar senha: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  // Atualizar senha
  async updatePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`Usuário com ID ${id} não encontrado`);
    }

    // Verificar senha atual
    const isPasswordValid = await this.verifyPassword(user, currentPassword);
    if (!isPasswordValid) {
      throw new ConflictException('Senha atual incorreta');
    }

    // Hash da nova senha
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    this.logger.log(`Senha atualizada com sucesso para o usuário: ${id}`);
  }
}
