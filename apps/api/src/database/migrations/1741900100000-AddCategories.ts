import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCategories1741900100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" SERIAL NOT NULL,
        "name" character varying(100) NOT NULL,
        "color" character varying(7),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_categories_name" UNIQUE ("name"),
        CONSTRAINT "PK_categories" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "services"
      ADD COLUMN "category_id" integer
    `);

    await queryRunner.query(`
      ALTER TABLE "services"
      ADD CONSTRAINT "FK_services_category"
      FOREIGN KEY ("category_id") REFERENCES "categories"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "services" DROP CONSTRAINT "FK_services_category"`,
    );
    await queryRunner.query(`ALTER TABLE "services" DROP COLUMN "category_id"`);
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}
