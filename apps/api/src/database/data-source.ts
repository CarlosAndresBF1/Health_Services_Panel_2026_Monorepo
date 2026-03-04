import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

// Load .env from root
config({ path: join(__dirname, '../../../../.env') });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'healthpanel',
  password: process.env.DB_PASSWORD || 'healthpanel_secret',
  database: process.env.DB_DATABASE || 'healthpanel',
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  synchronize: false, // NEVER true
  logging: process.env.NODE_ENV === 'development',
});
