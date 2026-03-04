import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

interface HealthResponse {
  name: string;
  version: string;
  status: string;
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth(): HealthResponse {
    return this.appService.getHealth();
  }
}
