import { join } from "path";

import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AlertsModule } from "./modules/alerts/alerts.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { DomainModule } from "./modules/domain/domain.module";
import { HealthCheckerModule } from "./modules/health-checker/health-checker.module";
import { LogsModule } from "./modules/logs/logs.module";
import { ServicesModule } from "./modules/services/services.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: configService.get("DB_HOST", "localhost"),
        port: configService.get<number>("DB_PORT", 5432),
        username: configService.get("DB_USERNAME", "healthpanel"),
        password: configService.get("DB_PASSWORD", "healthpanel_secret"),
        database: configService.get("DB_DATABASE", "healthpanel"),
        entities: [join(__dirname, "**/*.entity{.ts,.js}")],
        synchronize: false, // NEVER true - use migrations instead
        logging: configService.get("NODE_ENV") === "development",
        retryAttempts: 10,
        retryDelay: 3000, // ms between retry attempts
      }),
    }),
    AuthModule,
    CategoriesModule,
    ServicesModule,
    HealthCheckerModule,
    LogsModule,
    AlertsModule,
    DomainModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
