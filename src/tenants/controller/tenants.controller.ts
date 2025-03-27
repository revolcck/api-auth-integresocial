import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import {
  CreateTenantDto,
  UpdateTenantDto,
  TenantResponseDto,
  AddUserToTenantDto,
  createTenantSchema,
  updateTenantSchema,
  addUserToTenantSchema,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(createTenantSchema))
    createTenantDto: CreateTenantDto,
  ): Promise<TenantResponseDto> {
    return this.tenantsService.create(createTenantDto);
  }

  @Get()
  async findAll(): Promise<TenantResponseDto[]> {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<TenantResponseDto> {
    return this.tenantsService.findById(id);
  }

  @Get('by-subdomain/:subdomain')
  async findBySubdomain(
    @Param('subdomain') subdomain: string,
  ): Promise<TenantResponseDto> {
    return this.tenantsService.findBySubdomain(subdomain);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTenantSchema))
    updateTenantDto: UpdateTenantDto,
  ): Promise<TenantResponseDto> {
    return this.tenantsService.update(id, updateTenantDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.tenantsService.remove(id);
  }

  @Post(':id/users')
  @HttpCode(HttpStatus.NO_CONTENT)
  async addUser(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addUserToTenantSchema))
    addUserDto: AddUserToTenantDto,
  ): Promise<void> {
    return this.tenantsService.addUser(id, addUserDto);
  }

  @Delete(':id/users/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.tenantsService.removeUser(id, userId);
  }

  @Get(':id/users')
  async listUsers(@Param('id') id: string): Promise<any[]> {
    return this.tenantsService.listUsers(id);
  }
}
