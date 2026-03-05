import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { Service } from '../entities/service.entity';
import { Seeder } from './seeder.interface';

/**
 * Encrypt a plaintext using AES-256-GCM (same algorithm as CryptoService).
 * Returns `iv:authTag:ciphertext` (all hex).
 */
function encryptSecret(plaintext: string): string {
  const rawKey = process.env['ENCRYPTION_KEY'] ?? '';
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    key = Buffer.from(rawKey, 'hex');
  } else if (rawKey.length >= 32) {
    key = Buffer.from(rawKey.slice(0, 32), 'utf-8');
  } else {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

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
        monitorSecret: encryptSecret(crypto.randomBytes(32).toString('hex')),
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
        monitorSecret: encryptSecret(crypto.randomBytes(32).toString('hex')),
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
        monitorSecret: encryptSecret(crypto.randomBytes(32).toString('hex')),
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
