import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateInitialTables1709500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------------------------------------------------------------------------
    // 1. users
    // ---------------------------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'username',
            type: 'varchar',
            length: '100',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'password',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // ---------------------------------------------------------------------------
    // 2. service_type enum
    // ---------------------------------------------------------------------------
    await queryRunner.query(
      `CREATE TYPE "service_type_enum" AS ENUM ('api_nestjs', 'api_laravel', 'web_nextjs')`,
    );

    // ---------------------------------------------------------------------------
    // 3. services
    // ---------------------------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'services',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'url',
            type: 'varchar',
            length: '2048',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'service_type_enum',
            isNullable: false,
          },
          {
            name: 'health_endpoint',
            type: 'varchar',
            length: '255',
            default: "'/health'",
            isNullable: false,
          },
          {
            name: 'logs_endpoint',
            type: 'varchar',
            length: '255',
            default: "'/logs'",
            isNullable: false,
          },
          {
            name: 'monitor_api_key',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'monitor_secret',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'check_interval_seconds',
            type: 'integer',
            default: 60,
            isNullable: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'alerts_enabled',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'deleted_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'services',
      new TableIndex({
        name: 'IDX_services_is_active',
        columnNames: ['is_active'],
      }),
    );

    // ---------------------------------------------------------------------------
    // 4. health_check_status enum
    // ---------------------------------------------------------------------------
    await queryRunner.query(
      `CREATE TYPE "health_check_status_enum" AS ENUM ('up', 'down', 'degraded')`,
    );

    // ---------------------------------------------------------------------------
    // 5. health_checks
    // ---------------------------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'health_checks',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'service_id',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'health_check_status_enum',
            isNullable: false,
          },
          {
            name: 'response_time_ms',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'status_code',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'checked_at',
            type: 'timestamp with time zone',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'health_checks',
      new TableForeignKey({
        name: 'FK_health_checks_service_id',
        columnNames: ['service_id'],
        referencedTableName: 'services',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'health_checks',
      new TableIndex({
        name: 'IDX_health_checks_service_id_checked_at',
        columnNames: ['service_id', 'checked_at'],
      }),
    );

    // ---------------------------------------------------------------------------
    // 6. incidents
    // ---------------------------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'incidents',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'service_id',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'started_at',
            type: 'timestamp with time zone',
            isNullable: false,
          },
          {
            name: 'resolved_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'screenshot_path',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'last_logs_snapshot',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'email_sent',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'email_sent_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'incidents',
      new TableForeignKey({
        name: 'FK_incidents_service_id',
        columnNames: ['service_id'],
        referencedTableName: 'services',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'incidents',
      new TableIndex({
        name: 'IDX_incidents_service_id_started_at',
        columnNames: ['service_id', 'started_at'],
      }),
    );

    // ---------------------------------------------------------------------------
    // 7. settings
    // ---------------------------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'settings',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'key',
            type: 'varchar',
            length: '100',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'value',
            type: 'text',
            isNullable: false,
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse dependency order

    // settings (no FK deps)
    await queryRunner.dropTable('settings', true);

    // incidents → services
    await queryRunner.dropIndex('incidents', 'IDX_incidents_service_id_started_at');
    await queryRunner.dropForeignKey('incidents', 'FK_incidents_service_id');
    await queryRunner.dropTable('incidents', true);

    // health_checks → services
    await queryRunner.dropIndex('health_checks', 'IDX_health_checks_service_id_checked_at');
    await queryRunner.dropForeignKey('health_checks', 'FK_health_checks_service_id');
    await queryRunner.dropTable('health_checks', true);

    await queryRunner.query(`DROP TYPE IF EXISTS "health_check_status_enum"`);

    // services
    await queryRunner.dropIndex('services', 'IDX_services_is_active');
    await queryRunner.dropTable('services', true);

    await queryRunner.query(`DROP TYPE IF EXISTS "service_type_enum"`);

    // users
    await queryRunner.dropTable('users', true);
  }
}
