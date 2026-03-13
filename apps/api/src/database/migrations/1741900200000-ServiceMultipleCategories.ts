import { MigrationInterface, QueryRunner } from "typeorm";

export class ServiceMultipleCategories1741900200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create junction table
    await queryRunner.query(`
      CREATE TABLE "service_categories" (
        "service_id"  integer NOT NULL,
        "category_id" integer NOT NULL,
        CONSTRAINT "PK_service_categories" PRIMARY KEY ("service_id", "category_id"),
        CONSTRAINT "FK_service_categories_service"  FOREIGN KEY ("service_id")  REFERENCES "services"("id")    ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_service_categories_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id")  ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_service_categories_service"  ON "service_categories" ("service_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_service_categories_category" ON "service_categories" ("category_id")
    `);

    // 2. Migrate existing data from category_id column
    await queryRunner.query(`
      INSERT INTO "service_categories" ("service_id", "category_id")
      SELECT "id", "category_id"
      FROM "services"
      WHERE "category_id" IS NOT NULL
    `);

    // 3. Drop old FK and column
    await queryRunner.query(`
      ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "FK_services_category"
    `);
    await queryRunner.query(`
      ALTER TABLE "services" DROP COLUMN "category_id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Re-add category_id column
    await queryRunner.query(`
      ALTER TABLE "services" ADD COLUMN "category_id" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "services" ADD CONSTRAINT "FK_services_category"
      FOREIGN KEY ("category_id") REFERENCES "categories"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // 2. Migrate back (pick first category per service)
    await queryRunner.query(`
      UPDATE "services" s
      SET "category_id" = sc."category_id"
      FROM (
        SELECT DISTINCT ON ("service_id") "service_id", "category_id"
        FROM "service_categories"
        ORDER BY "service_id", "category_id"
      ) sc
      WHERE s."id" = sc."service_id"
    `);

    // 3. Drop junction table
    await queryRunner.query(`DROP TABLE "service_categories"`);
  }
}
