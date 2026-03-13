import { IsOptional, IsString, Length, Matches } from "class-validator";

export class CreateCategoryDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: "color must be a valid hex color (e.g. #FF5733)",
  })
  color?: string;
}
