import { Injectable } from '@nestjs/common';

interface HealthResponse {
  name: string;
  version: string;
  status: string;
}

@Injectable()
export class AppService {
  getHealth(): HealthResponse {
    return {
      name: 'HealthPanel API',
      version: '1.0.0',
      status: 'ok',
    };
  }
}
