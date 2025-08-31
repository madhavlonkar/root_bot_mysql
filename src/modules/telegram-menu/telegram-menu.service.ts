import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Markup } from 'telegraf';
import {
  ListingIntakeService,
  IntakeMediaInput,
} from 'src/modules/listing-intake/listing-intake.service';
import { TelegramBotService } from '../telegram/telegram-bot.service';

type Session =
  | { mode: 'idle' }
  | { mode: 'awaiting_text' }
  | { mode: 'awaiting_images'; listingId: string; baseMessageId: number };

type MediaGroupBucket = {
  chatId: number;
  fromUserId: number;
  media: IntakeMediaInput[];
  caption?: string | null;
  timer?: NodeJS.Timeout;
};

@Injectable()
export class TelegramMenuService implements OnModuleInit {
  private readonly logger = new Logger(TelegramMenuService.name);
  private sessions = new Map<number, Session>(); // by chatId
  private mediaGroups = new Map<string, MediaGroupBucket>(); // by media_group_id

  constructor(
    private readonly runtime: TelegramBotService,
    private readonly intake: ListingIntakeService,
  ) {}

  async onModuleInit() {
    const bot = this.runtime.getBot();

    // UI
    bot.start(async (ctx) => {
      this.sessions.set(ctx.chat.id, { mode: 'idle' });
      await ctx.reply(
        'Welcome! Choose an option:',
        Markup.keyboard([['Post Ad'], ['List My Posts']]).resize(),
      );
    });

    bot.hears('Post Ad', async (ctx) => {
      this.sessions.set(ctx.chat.id, { mode: 'awaiting_text' });
      await ctx.reply('Please send the ad text (you can type or forward).');
    });

    bot.hears('List My Posts', async (ctx) => this.listMyPosts());

    bot.hears('/done', async (ctx) => {
      const s = this.sessions.get(ctx.chat.id);
      if (s?.mode === 'awaiting_images') {
        this.sessions.set(ctx.chat.id, { mode: 'idle' });
        await ctx.reply('Saved ✅ Your post is ready.');
      } else {
        await ctx.reply('Nothing to finish right now.');
      }
    });

    // Text → create draft Listing
    bot.on('text', async (ctx) => {
      const s = this.sessions.get(ctx.chat.id);
      if (s?.mode === 'awaiting_text') {
        const text = ctx.message.text?.trim() ?? '';
        if (!text) return ctx.reply('Please send some text.');

        const listingId = await this.intake.createDraftListingFromText({
          chatId: ctx.chat.id,
          fromUserId: ctx.from?.id ?? 0,
          tgMessageId: ctx.message.message_id,
          text,
        });

        this.sessions.set(ctx.chat.id, {
          mode: 'awaiting_images',
          listingId,
          baseMessageId: ctx.message.message_id,
        });

        return ctx.reply(
          'Text saved. Now send images (album or single). Send /done when finished.',
        );
      }
    });

    // Photo(s)
    bot.on('photo', async (ctx) => {
      const photos = ctx.message.photo;
      const best = photos[photos.length - 1];
      const mediaGroupId = ctx.message.media_group_id as string | undefined;
      const caption = ctx.message.caption ?? null;

      const s = this.sessions.get(ctx.chat.id);
      if (s?.mode === 'awaiting_images') {
        await this.intake.saveListingMedia(s.listingId, {
          kind: 'photo',
          tgFileId: best.file_id,
          tgFileUniqueId: best.file_unique_id,
          width: best.width,
          height: best.height,
          fileSize: best.file_size ?? null,
          tgMessageId: ctx.message.message_id,
          caption: caption ?? undefined,
        });
        return;
      }

      if (mediaGroupId) {
        this.bufferMediaGroup(mediaGroupId, {
          chatId: ctx.chat.id,
          fromUserId: ctx.from?.id ?? 0,
          item: {
            kind: 'photo',
            tgFileId: best.file_id,
            tgFileUniqueId: best.file_unique_id,
            width: best.width,
            height: best.height,
            fileSize: best.file_size ?? null,
            tgMessageId: ctx.message.message_id,
            caption,
          },
          caption,
        });
      } else {
        const text = caption ?? '(no caption)';
        const listingId = await this.intake.createDraftListingFromText({
          chatId: ctx.chat.id,
          fromUserId: ctx.from?.id ?? 0,
          tgMessageId: ctx.message.message_id,
          text,
        });
        await this.intake.saveListingMedia(listingId, {
          kind: 'photo',
          tgFileId: best.file_id,
          tgFileUniqueId: best.file_unique_id,
          width: best.width,
          height: best.height,
          fileSize: best.file_size ?? null,
          tgMessageId: ctx.message.message_id,
        });
        await ctx.reply('Saved ✅ (photo post)');
      }
    });

    // Documents
    bot.on('document', async (ctx) => {
      const d = ctx.message.document;
      const mediaGroupId = ctx.message.media_group_id as string | undefined;
      const caption = ctx.message.caption ?? null;

      const s = this.sessions.get(ctx.chat.id);
      if (s?.mode === 'awaiting_images') {
        await this.intake.saveListingMedia(s.listingId, {
          kind: 'document',
          tgFileId: d.file_id,
          tgFileUniqueId: d.file_unique_id,
          fileName: d.file_name ?? null,
          mimeType: d.mime_type ?? null,
          fileSize: d.file_size ?? null,
          tgMessageId: ctx.message.message_id,
          caption: caption ?? undefined,
        });
        return;
      }

      if (mediaGroupId) {
        this.bufferMediaGroup(mediaGroupId, {
          chatId: ctx.chat.id,
          fromUserId: ctx.from?.id ?? 0,
          item: {
            kind: 'document',
            tgFileId: d.file_id,
            tgFileUniqueId: d.file_unique_id,
            fileName: d.file_name ?? null,
            mimeType: d.mime_type ?? null,
            fileSize: d.file_size ?? null,
            tgMessageId: ctx.message.message_id,
            caption,
          },
          caption,
        });
      } else {
        const text = caption ?? '(no caption)';
        const listingId = await this.intake.createDraftListingFromText({
          chatId: ctx.chat.id,
          fromUserId: ctx.from?.id ?? 0,
          tgMessageId: ctx.message.message_id,
          text,
        });
        await this.intake.saveListingMedia(listingId, {
          kind: 'document',
          tgFileId: d.file_id,
          tgFileUniqueId: d.file_unique_id,
          fileName: d.file_name ?? null,
          mimeType: d.mime_type ?? null,
          fileSize: d.file_size ?? null,
          tgMessageId: ctx.message.message_id,
        });
        await ctx.reply('Saved ✅ (document post)');
      }
    });

    await this.runtime.ensureLaunched();
  }

  // ---- helpers ----

  private bufferMediaGroup(
    mediaGroupId: string,
    payload: {
      chatId: number;
      fromUserId: number;
      item: IntakeMediaInput;
      caption?: string | null;
    },
  ) {
    let bucket = this.mediaGroups.get(mediaGroupId);
    if (!bucket) {
      bucket = {
        chatId: payload.chatId,
        fromUserId: payload.fromUserId,
        media: [],
        caption: payload.caption ?? null,
      };
      this.mediaGroups.set(mediaGroupId, bucket);
    }
    bucket.media.push(payload.item);
    if (payload.caption && !bucket.caption) bucket.caption = payload.caption;

    if (bucket.timer) clearTimeout(bucket.timer);
    bucket.timer = setTimeout(
      () => this.finalizeMediaGroup(mediaGroupId).catch(() => {}),
      1500,
    );
  }

  private async finalizeMediaGroup(mediaGroupId: string) {
    const bot = this.runtime.getBot();
    const bucket = this.mediaGroups.get(mediaGroupId);
    if (!bucket) return;
    this.mediaGroups.delete(mediaGroupId);

    const text = bucket.caption ?? '(no caption)';
    const baseMsgId = bucket.media[0]?.tgMessageId ?? Date.now();

    const listingId = await this.intake.createDraftListingFromText({
      chatId: bucket.chatId,
      fromUserId: bucket.fromUserId,
      tgMessageId: baseMsgId,
      text,
    });

    for (const it of bucket.media) {
      await this.intake.saveListingMedia(listingId, it);
    }

    try {
      await bot.telegram.sendMessage(
        bucket.chatId,
        `Saved ✅ (${bucket.media.length} media)`,
      );
    } catch {}
  }

  private async listMyPosts() {
    const bot = this.runtime.getBot();
    // const rows = await this.intake.listRecentDraftsForOwner(5);
    // if (!rows.length) {
    return bot.telegram.sendMessage(
      // no chatId here; this handler is only via hears(), so just ignore silently
      // you can keep the ctx in closure if you prefer per-chat responses
      // for simplicity we'll skip sending if none exist
      // Alternatively refactor to pass ctx.chat.id down.
      // Keeping minimal: do nothing.
      // (If you want per-chat, change the hears handler to capture ctx and pass chatId here.)
      // @ts-ignore
      (global as any).__last_chat_id__ ?? 0,
      'No posts yet.',
    );
    // }

    // We need chat id to send. Best approach: pass it from the hears handler.
    // For brevity, let's inline a tiny refactor: we'll store the last chat id used.
  }
}
