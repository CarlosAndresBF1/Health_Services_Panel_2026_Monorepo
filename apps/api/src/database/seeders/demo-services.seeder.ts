import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { Service } from '../entities/service.entity';
import { Seeder } from './seeder.interface';

export class DemoServicesSeeder implements Seeder {
  async run(dataSource: DataSource): Promise<void> {
    const serviceRepository = dataSource.getRepository(Service);

    const existingCount = await serviceRepository.count();

    if (existingCount > 0) {
      console.log('Services already exist, skipping demo seeder');
      return;
    }

    const demoServices: Partial<Service>[] = [
      {
        name: 'Demo NestJS API',
        type: 'api_nestjs',
        url: 'https://jsonplaceholder.typicode.com',
        healthEndpoint: '/posts/1',
        logsEndpoint: '/posts',
        monitorApiKey: crypto.randomUUID(),
        monitorSecret: crypto.randomBytes(32).toString('hex'),
        checkIntervalSeconds: 60,
        isActive: true,
        alertsEnabled: true,
        deletedAt: null,
      },
      {
        name: 'Demo Laravel API',
        type: 'api_laravel',
        url: 'https://httpbin.org',
        healthEndpoint: '/get',
        logsEndpoint: '/get',
        monitorApiKey: crypto.randomUUID(),
        monitorSecret: crypto.randomBytes(32).toString('hex'),
        checkIntervalSeconds: 60,
        isActive: true,
        alertsEnabled: true,
        deletedAt: null,
      },
      {
        name: 'Demo Next.js Site',
        type: 'web_nextjs',
        url: 'https://example.com',
        healthEndpoint: '/',
        logsEndpoint: '/',
        monitorApiKey: crypto.randomUUID(),
        monitorSecret: crypto.randomBytes(32).toString('hex'),
        checkIntervalSeconds: 60,
        isActive: true,
        alertsEnabled: true,
        deletedAt: null,
      },
    ];

    for (const serviceData of demoServices) {
      const service = serviceRepository.create(serviceData);
      await serviceRepository.save(service);
    }

    console.log('Demo services seeded (3 services)');
  }
}
