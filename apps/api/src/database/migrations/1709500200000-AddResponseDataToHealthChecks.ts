import { MigrationInterface, QueryRunner } from "typeorm";

export class AddResponseDataToHealthChecks1709500200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "health_checks" ADD COLUMN "response_data" JSONB NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "health_checks" DROP COLUMN "response_data"`,
    );
  }
}
