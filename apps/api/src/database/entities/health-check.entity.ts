import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Service } from "./service.entity";

@Entity("health_checks")
export class HealthCheck {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "service_id" })
  serviceId!: number;

  @Column({ type: "enum", enum: ["up", "down", "degraded"] })
  status!: string;

  @Column({ name: "response_time_ms", type: "int", nullable: true })
  responseTimeMs!: number | null;

  @Column({ name: "status_code", type: "int", nullable: true })
  statusCode!: number | null;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage!: string | null;

  @Column({ name: "response_data", type: "jsonb", nullable: true })
  responseData!: Record<string, unknown> | null;

  @Column({ name: "checked_at", type: "timestamp with time zone" })
  checkedAt!: Date;

  @ManyToOne(() => Service, (service) => service.healthChecks)
  @JoinColumn({ name: "service_id" })
  service!: Service;
}
