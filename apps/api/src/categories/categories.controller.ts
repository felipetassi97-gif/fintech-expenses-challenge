import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Controller('categories')
@UseGuards(AuthGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateCategoryDto) {
    return this.categories.create(req.userId, dto);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest) { return this.categories.list(req.userId); }

  @Get(':id')
  get(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.categories.get(req.userId, id); }

  @Patch(':id')
  update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(req.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.categories.remove(req.userId, id); }
}
