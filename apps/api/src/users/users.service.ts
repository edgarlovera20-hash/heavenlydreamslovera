import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        nombre: true,
        email: true,
        username: true,
        role: true,
        zona: true,
        puesto: true,
        avatar: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        companyId: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        email: true,
        username: true,
        role: true,
        zona: true,
        puesto: true,
        avatar: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        companyId: true,
      },
    });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return user;
  }

  async create(dto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        ...dto,
        password: hashedPassword,
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        username: true,
        role: true,
        zona: true,
        puesto: true,
        active: true,
        createdAt: true,
        companyId: true,
      },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        nombre: true,
        email: true,
        username: true,
        role: true,
        zona: true,
        puesto: true,
        active: true,
        updatedAt: true,
        companyId: true,
      },
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { active: false },
      select: { id: true, active: true, updatedAt: true },
    });
  }

  async changePassword(id: string, newPassword: string) {
    await this.findOne(id);
    const hashed = await bcrypt.hash(newPassword, 10);
    return this.prisma.user.update({
      where: { id },
      data: { password: hashed },
      select: { id: true, updatedAt: true },
    });
  }
}
