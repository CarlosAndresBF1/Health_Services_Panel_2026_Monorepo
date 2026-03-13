import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from "typeorm";

export class AddDomainChecks1741900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create domain_check_status enum
    await queryRunner.query(`
      CREATE TYPE "domain_check_status_enum" AS ENUM (
        'ok',
        'expiring_soon',
        'expired',
        'unknown'
      )
    `);

    // Create domain_checks table
    await queryRunner.createTable(
      new Table({
        name: "domain_checks",
        columns: [
          {
            name: "id",
            type: "integer",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "service_id",
            type: "integer",
            isNullable: false,
          },
          {
            name: "domain",
            type: "varchar",
            length: "255",
            isNullable: false,
          },
          {
            name: "expires_at",
            type: "timestamp with time zone",
            isNullable: true,
          },
          {
            name: "days_until_expiry",
            type: "integer",
            isNullable: true,
          },
          {
            name: "status",
            type: "domain_check_status_enum",
            default: "'unknown'",
          },
          {
            name: "registrar",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "error",
            type: "text",
            isNullable: true,
          },
          {
            name: "alert_sent",
            type: "boolean",
            default: false,
          },
          {
            name: "checked_at",
            type: "timestamp with time zone",
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // FK to services
    await queryRunner.createForeignKey(
      "domain_checks",
      new TableForeignKey({
        columnNames: ["service_id"],
        referencedTableName: "services",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      }),
    );

    // Index for fast lookup by service_id
    await queryRunner.createIndex(
      "domain_checks",
      new TableIndex({
        name: "IDX_domain_checks_service_id",
        columnNames: ["service_id"],
      }),
    );

    // Index for sorting by checked_at
    await queryRunner.createIndex(
      "domain_checks",
      new TableIndex({
        name: "IDX_domain_checks_checked_at",
        columnNames: ["checked_at"],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("domain_checks", true);
    await queryRunner.query(`DROP TYPE IF EXISTS "domain_check_status_enum"`);
  }
}
