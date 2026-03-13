import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Category } from "../../database/entities/category.entity";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

export interface CategoryResponse {
  id: number;
  name: string;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async create(dto: CreateCategoryDto): Promise<CategoryResponse> {
    const exists = await this.categoryRepository.findOne({
      where: { name: dto.name },
    });
    if (exists) {
      throw new ConflictException(`Category "${dto.name}" already exists`);
    }

    const category = this.categoryRepository.create({
      name: dto.name,
      color: dto.color ?? null,
    });
    const saved = await this.categoryRepository.save(category);
    return this.toResponse(saved);
  }

  async findAll(): Promise<CategoryResponse[]> {
    const items = await this.categoryRepository.find({
      order: { name: "ASC" },
    });
    return items.map((c) => this.toResponse(c));
  }

  async findOne(id: number): Promise<CategoryResponse> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }
    return this.toResponse(category);
  }

  async update(id: number, dto: UpdateCategoryDto): Promise<CategoryResponse> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }

    if (dto.name !== undefined && dto.name !== category.name) {
      const duplicate = await this.categoryRepository.findOne({
        where: { name: dto.name },
      });
      if (duplicate) {
        throw new ConflictException(`Category "${dto.name}" already exists`);
      }
      category.name = dto.name;
    }
    if (dto.color !== undefined) category.color = dto.color;

    const saved = await this.categoryRepository.save(category);
    return this.toResponse(saved);
  }

  async remove(id: number): Promise<{ message: string }> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }
    await this.categoryRepository.remove(category);
    return { message: "Category deleted successfully" };
  }

  private toResponse(category: Category): CategoryResponse {
    return {
      id: category.id,
      name: category.name,
      color: category.color,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}
