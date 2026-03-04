import { DataSource } from 'typeorm';
import { Setting } from '../entities/setting.entity';
import { Seeder } from './seeder.interface';

export class SettingsSeeder implements Seeder {
  async run(dataSource: DataSource): Promise<void> {
    const settingRepository = dataSource.getRepository(Setting);

    const defaults: Array<{ key: string; value: string }> = [
      {
        key: 'alert_email_to',
        value: process.env.ALERT_EMAIL_TO || 'admin@example.com',
      },
      {
        key: 'alert_email_from',
        value: process.env.ALERT_EMAIL_FROM || 'monitor@example.com',
      },
      {
        key: 'alerts_enabled',
        value: 'true',
      },
      {
        key: 'alert_min_interval_ms',
        value: '300000',
      },
      {
        key: 'default_check_interval',
        value: process.env.DEFAULT_CHECK_INTERVAL || '60',
      },
    ];

    for (const entry of defaults) {
      const existing = await settingRepository.findOne({ where: { key: entry.key } });

      if (existing) {
        await settingRepository.update({ key: entry.key }, { value: entry.value });
      } else {
        const setting = settingRepository.create(entry);
        await settingRepository.save(setting);
      }
    }

    console.log(`Settings seeded successfully (${defaults.length} entries)`);
  }
}
