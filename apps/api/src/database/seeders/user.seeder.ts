import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { Seeder } from './seeder.interface';

export class UserSeeder implements Seeder {
  async run(dataSource: DataSource): Promise<void> {
    const userRepository = dataSource.getRepository(User);

    const username = process.env.SEED_USER || 'admin';
    const plainPassword = process.env.SEED_PASSWORD || 'admin123';
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    const existingUser = await userRepository.findOne({ where: { username } });

    if (existingUser) {
      await userRepository.update({ username }, { password: hashedPassword });
    } else {
      const user = userRepository.create({
        username,
        password: hashedPassword,
        isActive: true,
      });
      await userRepository.save(user);
    }

    console.log(`User '${username}' seeded successfully`);
  }
}
