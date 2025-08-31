import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot!: Telegraf;
  private launched = false;

  constructor(private readonly cfg: ConfigService) {}

  onModuleInit() {
    const token = this.cfg.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing');
    this.bot = new Telegraf(token);
  }

  getBot(): Telegraf {
    return this.bot;
  }

  async ensureLaunched() {
    if (this.launched) return;
    await this.bot.launch();
    this.launched = true;
    this.logger.log('Telegram bot launched (polling).');
  }

  async onModuleDestroy() {
    if (this.bot) await this.bot.stop();
  }
}
