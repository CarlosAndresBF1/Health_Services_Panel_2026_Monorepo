import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Service } from './service.entity';

@Entity('incidents')
export class Incident {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'service_id' })
  serviceId: number;

  @Column({ name: 'started_at', type: 'timestamp with time zone' })
  startedAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamp with time zone', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'screenshot_path', length: 500, nullable: true })
  screenshotPath: string | null;

  @Column({ name: 'last_logs_snapshot', type: 'text', nullable: true })
  lastLogsSnapshot: string | null;

  @Column({ name: 'email_sent', default: false })
  emailSent: boolean;

  @Column({ name: 'email_sent_at', type: 'timestamp with time zone', nullable: true })
  emailSentAt: Date | null;

  @ManyToOne(() => Service, (service) => service.incidents)
  @JoinColumn({ name: 'service_id' })
  service: Service;
}
