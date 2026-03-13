import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Service } from "./service.entity";

export enum DomainCheckStatus {
  OK = "ok",
  EXPIRING_SOON = "expiring_soon",
  EXPIRED = "expired",
  UNKNOWN = "unknown",
}

@Entity("domain_checks")
export class DomainCheck {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "service_id" })
  serviceId!: number;

  @Column({ length: 255 })
  domain!: string;

  @Column({
    name: "expires_at",
    type: "timestamp with time zone",
    nullable: true,
  })
  expiresAt!: Date | null;

  @Column({ name: "days_until_expiry", type: "int", nullable: true })
  daysUntilExpiry!: number | null;

  @Column({
    type: "enum",
    enum: DomainCheckStatus,
    default: DomainCheckStatus.UNKNOWN,
  })
  status!: DomainCheckStatus;

  /** The registrar name extracted from the WHOIS response */
  @Column({ type: "varchar", length: 255, nullable: true })
  registrar!: string | null;

  /** Error message if the WHOIS query failed */
  @Column({ type: "text", nullable: true })
  error!: string | null;

  /** Whether a domain expiry alert email has been sent for this check cycle */
  @Column({ name: "alert_sent", default: false })
  alertSent!: boolean;

  @Column({ name: "checked_at", type: "timestamp with time zone" })
  checkedAt!: Date;

  @ManyToOne(() => Service)
  @JoinColumn({ name: "service_id" })
  service!: Service;
}
