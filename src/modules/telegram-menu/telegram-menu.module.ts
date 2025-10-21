import { Module } from '@nestjs/common';
import { TelegramBotModule } from 'src/modules/telegram/telegram-bot.module';
import { ListingIntakeModule } from '../listing-intake/listing-intake.module';
import { TelegramMenuService } from './telegram-menu.service';
import { ListingsModule } from '../listings/listings.module';

@Module({
  imports: [TelegramBotModule, ListingIntakeModule, ListingsModule],
  providers: [TelegramMenuService],
})
export class TelegramMenuModule {}
