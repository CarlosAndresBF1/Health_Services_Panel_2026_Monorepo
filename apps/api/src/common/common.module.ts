import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { CryptoService } from "./crypto.service";
import { HmacSignerService } from "./hmac-signer.service";

@Module({
  imports: [ConfigModule],
  providers: [CryptoService, HmacSignerService],
  exports: [CryptoService, HmacSignerService],
})
export class CommonModule {}
