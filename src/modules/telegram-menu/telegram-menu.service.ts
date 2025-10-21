import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TelegramBotService } from 'src/modules/telegram/telegram-bot.service';
import { ListingIntakeService } from 'src/modules/listing-intake/listing-intake.service';
import { Session } from './types';
import { registerPostQuickFlow } from './flows/post-quick.flow';
import { registerNavHandlers } from './flows/nav.handler';
import { registerGuidedFlow } from './flows/guided.flow';
import { registerBrowseFlow } from './flows/browse.flow';
import { ListingService } from '../listings/listing.service';

@Injectable()
export class TelegramMenuService implements OnModuleInit {
  private readonly logger = new Logger(TelegramMenuService.name);
  private sessions = new Map<number, Session>();

  constructor(
    private readonly runtime: TelegramBotService,
    private readonly intake: ListingIntakeService,
    private readonly listings: ListingService,
  ) {}

  async onModuleInit() {
    const bot = this.runtime.getBot();

    // Wire handlers
    registerNavHandlers(bot, this.sessions, this.intake);
    registerPostQuickFlow(bot, this.runtime, this.sessions, this.intake);
    registerGuidedFlow(bot, this.runtime, this.sessions, this.intake);
    registerBrowseFlow(
      bot,
      this.runtime,
      this.sessions,
      this.intake,
      this.listings,
    );

    await this.runtime.ensureLaunched();
    this.logger.log('TelegramMenuService handlers registered.');
  }
}
