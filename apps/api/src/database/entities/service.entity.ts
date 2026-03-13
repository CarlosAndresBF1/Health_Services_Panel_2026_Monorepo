import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Category } from "./category.entity";
import { HealthCheck } from "./health-check.entity";
import { Incident } from "./incident.entity";

@Entity("services")
export class Service {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 255 })
  name!: string;

  @Column({ length: 2048 })
  url!: string;

  @Column({ type: "enum", enum: ["api_nestjs", "api_laravel", "web_nextjs"] })
  type!: string;

  @Column({ name: "health_endpoint", length: 255, default: "/health" })
  healthEndpoint!: string;

  @Column({ name: "logs_endpoint", length: 255, default: "/logs" })
  logsEndpoint!: string;

  @Column({ name: "monitor_api_key", length: 255 })
  monitorApiKey!: string;

  @Column({ name: "monitor_secret", type: "text" })
  monitorSecret!: string; // AES-256-GCM encrypted

  @Column({ name: "check_interval_seconds", default: 60 })
  checkIntervalSeconds!: number;

  @Column({ name: "is_active", default: true })
  isActive!: boolean;

  @Column({ name: "alerts_enabled", default: true })
  alertsEnabled!: boolean;

  @Column({
    name: "deleted_at",
    nullable: true,
    type: "timestamp with time zone",
  })
  deletedAt!: Date | null; // soft delete

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  // Relations
  @ManyToMany(() => Category, (c) => c.services, { eager: false })
  @JoinTable({
    name: "service_categories",
    joinColumn: { name: "service_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "category_id", referencedColumnName: "id" },
  })
  categories!: Category[];

  @OneToMany(() => HealthCheck, (hc) => hc.service)
  healthChecks!: HealthCheck[];

  @OneToMany(() => Incident, (inc) => inc.service)
  incidents!: Incident[];
}
