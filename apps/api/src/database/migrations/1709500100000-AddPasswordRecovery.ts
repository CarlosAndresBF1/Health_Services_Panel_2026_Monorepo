import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddPasswordRecovery1709500100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add email column to users table
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "email" VARCHAR(255) NULL`,
    );

    // 2. Create password_reset_tokens table
    await queryRunner.createTable(
      new Table({
        name: 'password_reset_tokens',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'user_id',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'token',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'expires_at',
            type: 'timestamp with time zone',
            isNullable: false,
          },
          {
            name: 'used_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // 3. Add foreign key: password_reset_tokens.user_id -> users.id
    await queryRunner.createForeignKey(
      'password_reset_tokens',
      new TableForeignKey({
        name: 'FK_password_reset_tokens_user_id',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // 4. Index on token for fast lookup
    await queryRunner.createIndex(
      'password_reset_tokens',
      new TableIndex({
        name: 'IDX_password_reset_tokens_token',
        columnNames: ['token'],
      }),
    );

    // 5. Index on user_id for fast lookup
    await queryRunner.createIndex(
      'password_reset_tokens',
      new TableIndex({
        name: 'IDX_password_reset_tokens_user_id',
        columnNames: ['user_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex(
      'password_reset_tokens',
      'IDX_password_reset_tokens_user_id',
    );
    await queryRunner.dropIndex(
      'password_reset_tokens',
      'IDX_password_reset_tokens_token',
    );

    // Drop foreign key
    await queryRunner.dropForeignKey(
      'password_reset_tokens',
      'FK_password_reset_tokens_user_id',
    );

    // Drop password_reset_tokens table
    await queryRunner.dropTable('password_reset_tokens', true);

    // Drop email column from users
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "email"`,
    );
  }
}
