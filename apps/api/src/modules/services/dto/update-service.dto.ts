import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
} from "class-validator";

import { ServiceType } from "@healthpanel/shared";

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @Length(1, 2048)
  url?: string;

  @IsOptional()
  @IsEnum(ServiceType)
  type?: ServiceType;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  healthEndpoint?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  logsEndpoint?: string;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(3600)
  checkIntervalSeconds?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  alertsEnabled?: boolean;
}
