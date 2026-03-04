import { AppDataSource } from '../data-source';
import { UserSeeder } from './user.seeder';
import { SettingsSeeder } from './settings.seeder';
import { DemoServicesSeeder } from './demo-services.seeder';

async function runSeeders(): Promise<void> {
  console.log('Initializing data source...');

  try {
    await AppDataSource.initialize();
    console.log('Data source initialized.');

    console.log('Running UserSeeder...');
    await new UserSeeder().run(AppDataSource);

    console.log('Running SettingsSeeder...');
    await new SettingsSeeder().run(AppDataSource);

    console.log('Running DemoServicesSeeder...');
    await new DemoServicesSeeder().run(AppDataSource);

    console.log('All seeders completed successfully.');
  } catch (error) {
    console.error('Seeder failed:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('Data source connection closed.');
    }
  }
}

runSeeders();
