import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Markup } from 'telegraf';
import {
  ListingIntakeService,
  IntakeMediaInput,
} from 'src/modules/listing-intake/listing-intake.service';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import { MediaKind } from 'src/common/enums/flats.enum';

const MENU = {
  BROWSE: 'Browse 🏠',
  POST: 'Post Ad ➕',
  BOOSTED: 'Boosted 🔝',
  WISHLIST: 'Wishlist ⭐',
  MY_ADS: 'My Ads 📂',
  CREDITS: 'Credits 💳',
  SUPPORT: 'Support 🛟',
};

const ACTIONS = {
  CHOOSE_QUICK: 'post:quick',
  CHOOSE_GUIDED: 'post:guided',
  ADDPICS_PREFIX: 'addpics:',
  SKIP_PREFIX: 'skip:',
  IMGDONE_PREFIX: 'images:done:',
  IMGDISCARD_PREFIX: 'images:discard:',
  IMGMORE_PREFIX: 'images:more:',
} as const;

type Session =
  | { mode: 'idle' }
  | { mode: 'awaiting_text_quick' }
  | {
      mode: 'awaiting_images';
      listingId: string;
      uploadedCount: number;
      controlMsgId?: number;
      pending: IntakeMediaInput[];
    };

type AwaitingGroupBucket = {
  chatId: number;
  listingId: string;
  items: IntakeMediaInput[];
  timer?: NodeJS.Timeout;
};

type QuickAlbumBucket = {
  chatId: number;
  fromUserId: number;
  fromUsername?: string | null;
  fromDisplayName?: string | null;
  items: IntakeMediaInput[];
  caption?: string | null;
  timer?: NodeJS.Timeout;
};

@Injectable()
export class TelegramMenuService implements OnModuleInit {
  private readonly logger = new Logger(TelegramMenuService.name);
  private sessions = new Map<number, Session>(); // by chatId

  // buffer album uploads while in awaiting_images (7 photos → one counter update)
  private awaitingImgGroups = new Map<string, AwaitingGroupBucket>(); // key: media_group_id

  // buffer quick-flow albums (user sends an album with a caption first)
  private quickAlbums = new Map<string, QuickAlbumBucket>(); // key: media_group_id

  constructor(
    private readonly runtime: TelegramBotService,
    private readonly intake: ListingIntakeService,
  ) {}

  async onModuleInit() {
    const bot = this.runtime.getBot();

    await bot.telegram
      .setMyCommands([
        { command: 'browse', description: 'Browse listings' },
        { command: 'post', description: 'Create a new ad' },
        { command: 'myads', description: 'View my ads' },
        { command: 'wishlist', description: 'Wishlist' },
        { command: 'boosted', description: 'Boosted listings' },
        { command: 'credits', description: 'Credits' },
        { command: 'support', description: 'Support' },
      ])
      .catch(() => {});
    await bot.telegram.setChatMenuButton({}).catch(() => {});

    bot.start(async (ctx) => {
      this.sessions.set(ctx.chat.id, { mode: 'idle' });
      const keyboard = Markup.keyboard([
        [MENU.BROWSE, MENU.POST],
        [MENU.BOOSTED, MENU.WISHLIST],
        [MENU.MY_ADS, MENU.CREDITS],
        [MENU.SUPPORT],
      ]).resize();
      await ctx.replyWithHTML(
        [
          `👋 <b>Welcome to Room Bot</b>`,
          `Your quick hub to post, browse, and manage rental listings.`,
          ``,
          `Pick an option below to get started ⤵️`,
        ].join('\n'),
        keyboard,
      );
    });

    // commands + buttons -> helpers
    bot.command('browse', (ctx) => this.showBrowse(ctx));
    bot.command('post', (ctx) => this.showPostChooser(ctx));
    bot.command('myads', (ctx) => this.showMyAds(ctx));
    bot.command('wishlist', (ctx) => this.showWishlist(ctx));
    bot.command('boosted', (ctx) => this.showBoosted(ctx));
    bot.command('credits', (ctx) => this.showCredits(ctx));
    bot.command('support', (ctx) => this.showSupport(ctx));

    bot.hears(MENU.BROWSE, (ctx) => this.showBrowse(ctx));
    bot.hears(MENU.POST, (ctx) => this.showPostChooser(ctx));
    bot.hears(MENU.MY_ADS, (ctx) => this.showMyAds(ctx));
    bot.hears(MENU.WISHLIST, (ctx) => this.showWishlist(ctx));
    bot.hears(MENU.BOOSTED, (ctx) => this.showBoosted(ctx));
    bot.hears(MENU.CREDITS, (ctx) => this.showCredits(ctx));
    bot.hears(MENU.SUPPORT, (ctx) => this.showSupport(ctx));

    // POST submenu
    bot.action(ACTIONS.CHOOSE_QUICK as any, async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch {}
      this.sessions.set(ctx.chat!.id, { mode: 'awaiting_text_quick' });
      try {
        await ctx.editMessageText(
          '📝 Send the ad text (paste or forward). You can add photos afterwards.',
        );
      } catch {
        await ctx.reply(
          '📝 Send the ad text (paste or forward). You can add photos afterwards.',
        );
      }
    });

    bot.action(ACTIONS.CHOOSE_GUIDED as any, async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch {}
      await ctx.editMessageText('🧠 Guided mode coming next.');
    });

    // TEXT (strict gating)
    bot.on('text', async (ctx) => {
      const s = this.sessions.get(ctx.chat.id);
      if (s?.mode !== 'awaiting_text_quick') return;

      const text = ctx.message.text?.trim() ?? '';
      if (!text) return ctx.reply('Please send some text.');

      try {
        const listingId = await this.intake.createDraftListingFromText({
          chatId: ctx.chat.id,
          fromUserId: ctx.from?.id ?? 0,
          fromUsername: ctx.from?.username ?? null,
          fromDisplayName:
            [ctx.from?.first_name, ctx.from?.last_name]
              .filter(Boolean)
              .join(' ') || null,
          tgMessageId: ctx.message.message_id,
          text,
        });

        const chooseKb = Markup.inlineKeyboard([
          [
            Markup.button.callback(
              'Add photos 📸',
              ACTIONS.ADDPICS_PREFIX + listingId,
            ),
            Markup.button.callback(
              'Continue without photos ✅',
              ACTIONS.SKIP_PREFIX + listingId,
            ),
          ],
        ]);
        await ctx.replyWithHTML(
          `🖊️ <b>Text saved.</b>\nWould you like to add photos?`,
          chooseKb,
        );
        this.sessions.set(ctx.chat.id, { mode: 'idle' });
      } catch (e: any) {
        if (
          String(e?.message) === 'DUPLICATE_POST' ||
          String(e?.message) === 'DUPLICATE_TITLE'
        ) {
          return ctx.reply('⚠️ This post already exists in the system.');
        }
        return ctx.reply('❌ Could not save the ad. Please try again.');
      }
    });

    // After text: choose add photos / skip
    bot.action(new RegExp(`^${ACTIONS.ADDPICS_PREFIX}(.+)$`), async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch {}
      const listingId = ctx.match?.[1];
      if (!listingId) return;

      this.sessions.set(ctx.chat!.id, {
        mode: 'awaiting_images',
        listingId,
        uploadedCount: 0,
        pending: [],
      });

      try {
        await ctx.editMessageText(
          '📷 Please select photos (multiple allowed).',
        );
      } catch {
        await ctx.reply('📷 Please select photos (multiple allowed).');
      }
    });

    bot.action(new RegExp(`^${ACTIONS.SKIP_PREFIX}(.+)$`), async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch {}
      this.sessions.set(ctx.chat!.id, { mode: 'idle' });
      try {
        await ctx.editMessageText('✅ Saved! Your post is ready.');
      } catch {
        await ctx.reply('✅ Saved! Your post is ready.');
      }
    });

    // While adding photos
    bot.action(new RegExp(`^${ACTIONS.IMGDONE_PREFIX}(.+)$`), async (ctx) => {
      try {
        await ctx.answerCbQuery('Done.');
      } catch {}
      const listingId = ctx.match?.[1];

      const sess = this.sessions.get(ctx.chat!.id);
      if (
        !sess ||
        sess.mode !== 'awaiting_images' ||
        sess.listingId !== listingId
      )
        return;

      // 🔁 flush any buffered album for this chat/listing before saving
      this.flushAwaitingGroupBuffers(ctx.chat!.id, listingId, sess);

      const controlMsgId = sess.controlMsgId;
      const items = sess.pending.slice();
      let saved = 0,
        failed = 0;

      for (const it of items) {
        try {
          await this.intake.saveListingMedia(listingId, it);
          saved++;
        } catch {
          failed++;
        }
      }

      this.sessions.set(ctx.chat!.id, { mode: 'idle' });

      const summary = failed
        ? `✅ Saved! (${saved} added, ${failed} failed)`
        : `✅ Saved! (${saved} added)`;

      const botApi = this.runtime.getBot().telegram;
      if (controlMsgId) {
        try {
          await botApi.deleteMessage(ctx.chat!.id, controlMsgId);
        } catch {}
      }
      await ctx.reply(summary);
    });

    bot.action(
      new RegExp(`^${ACTIONS.IMGDISCARD_PREFIX}(.+)$`),
      async (ctx) => {
        try {
          await ctx.answerCbQuery('Continuing without photos');
        } catch {}
        const listingId = ctx.match?.[1];
        const sess = this.sessions.get(ctx.chat!.id);
        if (
          !sess ||
          sess.mode !== 'awaiting_images' ||
          sess.listingId !== listingId
        )
          return;

        // flush (and then drop) any buffered items so there are no dangling timers
        this.flushAwaitingGroupBuffers(
          ctx.chat!.id,
          listingId,
          sess,
          /*mergeIntoPending*/ false,
        );

        const controlMsgId = sess.controlMsgId;
        this.sessions.set(ctx.chat!.id, { mode: 'idle' });

        const botApi = this.runtime.getBot().telegram;
        if (controlMsgId) {
          try {
            await botApi.deleteMessage(ctx.chat!.id, controlMsgId);
          } catch {}
        }
        await ctx.reply('↩️ Continued without photos.');
      },
    );

    bot.action(new RegExp(`^${ACTIONS.IMGMORE_PREFIX}(.+)$`), async (ctx) => {
      try {
        await ctx.answerCbQuery('Select more…');
      } catch {}
      const sess = this.sessions.get(ctx.chat!.id);
      if (!sess || sess.mode !== 'awaiting_images') return;

      // Refresh the control card text so user gets visible feedback
      const text = `📷 Select more photos…\n📎 Currently attached: ${sess.uploadedCount}`;
      const kb = this.imagesControlKeyboard(sess.listingId);

      const botApi = this.runtime.getBot().telegram;
      if (sess.controlMsgId) {
        try {
          await botApi.editMessageText(
            ctx.chat!.id,
            sess.controlMsgId,
            undefined,
            text,
            kb,
          );
          return;
        } catch {}
      }
      await ctx.reply(text, kb);
    });

    // PHOTOS
    bot.on('photo', async (ctx) => {
      const s = this.sessions.get(ctx.chat.id);
      if (s?.mode !== 'awaiting_images' && s?.mode !== 'awaiting_text_quick') {
        return ctx.reply(
          'ℹ️ Please start from “Post Ad ➕ → Paste/Forward Ad ⚡”.',
        );
      }

      const photos = ctx.message.photo;
      const best = photos[photos.length - 1];
      const mediaGroupId = ctx.message.media_group_id as string | undefined;
      const caption = ctx.message.caption ?? null;

      // Case A: adding to existing listing (buffer + single counter message)
      if (s?.mode === 'awaiting_images') {
        const item: IntakeMediaInput = {
          kind: 'photo',
          tgFileId: best.file_id,
          tgFileUniqueId: best.file_unique_id,
          width: best.width,
          height: best.height,
          fileSize: best.file_size ?? null,
          tgMessageId: ctx.message.message_id,
          caption: caption ?? undefined,
        };

        if (mediaGroupId) {
          this.bufferAwaitingImageGroup(mediaGroupId, {
            chatId: ctx.chat.id,
            listingId: s.listingId,
            items: [item],
          });
        } else {
          s.pending.push(item);
          s.uploadedCount += 1;
          this.sessions.set(ctx.chat.id, s);
          await this.postFreshCounterMessage(ctx.chat.id, s);
        }
        return;
      }

      // Case B: quick flow (album before text)
      if (mediaGroupId) {
        this.bufferQuickAlbum(mediaGroupId, {
          chatId: ctx.chat.id,
          fromUserId: ctx.from?.id ?? 0,
          fromUsername: ctx.from?.username ?? null,
          fromDisplayName:
            [ctx.from?.first_name, ctx.from?.last_name]
              .filter(Boolean)
              .join(' ') || null,
          items: [
            {
              kind: 'photo',
              tgFileId: best.file_id,
              tgFileUniqueId: best.file_unique_id,
              width: best.width,
              height: best.height,
              fileSize: best.file_size ?? null,
              tgMessageId: ctx.message.message_id,
              caption,
            },
          ],
          caption,
        });
      } else {
        const text = caption ?? '(no caption)';
        try {
          const listingId = await this.intake.createDraftListingFromText({
            chatId: ctx.chat.id,
            fromUserId: ctx.from?.id ?? 0,
            fromUsername: ctx.from?.username ?? null,
            fromDisplayName:
              [ctx.from?.first_name, ctx.from?.last_name]
                .filter(Boolean)
                .join(' ') || null,
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
          await ctx.reply('✅ Saved (photo post).');
          this.sessions.set(ctx.chat.id, { mode: 'idle' });
        } catch (e: any) {
          if (
            String(e?.message) === 'DUPLICATE_POST' ||
            String(e?.message) === 'DUPLICATE_TITLE'
          ) {
            return ctx.reply('⚠️ This post already exists in the system.');
          }
          return ctx.reply('❌ Could not save the post.');
        }
      }
    });

    // DOCUMENTS
    bot.on('document', async (ctx) => {
      const s = this.sessions.get(ctx.chat.id);
      if (s?.mode !== 'awaiting_images' && s?.mode !== 'awaiting_text_quick') {
        return ctx.reply(
          'ℹ️ Please start from “Post Ad ➕ → Paste/Forward Ad ⚡”.',
        );
      }

      const d = ctx.message.document;
      const mediaGroupId = ctx.message.media_group_id as string | undefined;
      const caption = ctx.message.caption ?? null;

      if (s?.mode === 'awaiting_images') {
        const item: IntakeMediaInput = {
          kind: 'document',
          tgFileId: d.file_id,
          tgFileUniqueId: d.file_unique_id,
          fileName: d.file_name ?? null,
          mimeType: d.mime_type ?? null,
          fileSize: d.file_size ?? null,
          tgMessageId: ctx.message.message_id,
          caption: caption ?? undefined,
        };

        if (mediaGroupId) {
          this.bufferAwaitingImageGroup(mediaGroupId, {
            chatId: ctx.chat.id,
            listingId: s.listingId,
            items: [item],
          });
        } else {
          s.pending.push(item);
          s.uploadedCount += 1;
          this.sessions.set(ctx.chat.id, s);
          await this.postFreshCounterMessage(ctx.chat.id, s);
        }
        return;
      }

      // quick flow single document
      if (!mediaGroupId) {
        const text = caption ?? '(no caption)';
        try {
          const listingId = await this.intake.createDraftListingFromText({
            chatId: ctx.chat.id,
            fromUserId: ctx.from?.id ?? 0,
            fromUsername: ctx.from?.username ?? null,
            fromDisplayName:
              [ctx.from?.first_name, ctx.from?.last_name]
                .filter(Boolean)
                .join(' ') || null,
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
          await ctx.reply('✅ Saved (document post).');
          this.sessions.set(ctx.chat.id, { mode: 'idle' });
        } catch (e: any) {
          if (
            String(e?.message) === 'DUPLICATE_POST' ||
            String(e?.message) === 'DUPLICATE_TITLE'
          ) {
            return ctx.reply('⚠️ This post already exists in the system.');
          }
          return ctx.reply('❌ Could not save the post.');
        }
      } else {
        // quick album buffer (docs)
        this.bufferQuickAlbum(mediaGroupId, {
          chatId: ctx.chat.id,
          fromUserId: ctx.from?.id ?? 0,
          fromUsername: ctx.from?.username ?? null,
          fromDisplayName:
            [ctx.from?.first_name, ctx.from?.last_name]
              .filter(Boolean)
              .join(' ') || null,
          items: [itemFromDoc(d, caption, ctx.message.message_id)],
          caption,
        });
      }
    });

    await this.runtime.ensureLaunched();
  }

  // ---------- helpers ----------

  private async showPostChooser(ctx: any) {
    const ib = Markup.inlineKeyboard([
      [
        Markup.button.callback('Paste/Forward Ad ⚡', ACTIONS.CHOOSE_QUICK),
        Markup.button.callback(
          'Guided: Answer Questions 🧠',
          ACTIONS.CHOOSE_GUIDED,
        ),
      ],
    ]);
    await ctx.replyWithHTML(
      [
        `🧩 <b>Create an Ad</b>`,
        `Choose how you want to create your ad:`,
        `• <b>Paste/Forward Ad ⚡</b>: Paste/forward full ad text. Then attach photos if you want.`,
        `• <b>Guided: Answer Questions 🧠</b>: I’ll ask details and build your ad (coming next).`,
      ].join('\n'),
      ib,
    );
  }

  private async showBrowse(ctx: any) {
    await ctx.replyWithHTML(`🏠 <b>Browse</b>\nComing soon ✨`);
  }
  private async showBoosted(ctx: any) {
    await ctx.replyWithHTML(`🔝 <b>Boosted</b>\nNo boosted listings yet.`);
  }
  private async showWishlist(ctx: any) {
    await ctx.replyWithHTML(`⭐ <b>Wishlist</b>\nFeature coming soon!`);
  }
  private async showCredits(ctx: any) {
    await ctx.replyWithHTML(`💳 <b>Credits</b>\nLaunching shortly.`);
  }
  private async showSupport(ctx: any) {
    await ctx.replyWithHTML(
      `🛟 <b>Support</b>\nMessage here or email <i>support@roombot.local</i>.`,
    );
  }
  private async showMyAds(ctx: any) {
    return this.listMyAdsForChat(ctx.chat.id, ctx.from?.id ?? 0);
  }

  private imagesControlKeyboard(listingId: string) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          'I’m done ✅',
          ACTIONS.IMGDONE_PREFIX + listingId,
        ),
      ],
      [
        Markup.button.callback(
          'Continue without photos ↩️',
          ACTIONS.IMGDISCARD_PREFIX + listingId,
        ),
        Markup.button.callback(
          'Select more ➕',
          ACTIONS.IMGMORE_PREFIX + listingId,
        ),
      ],
    ]);
  }

  /** Delete previous control message (if any) and send a fresh one with new counter. */
  private async postFreshCounterMessage(
    chatId: number,
    s: Extract<Session, { mode: 'awaiting_images' }>,
  ) {
    const botApi = this.runtime.getBot().telegram;

    if (s.controlMsgId) {
      try {
        await botApi.deleteMessage(chatId, s.controlMsgId);
      } catch {}
      s.controlMsgId = undefined;
    }

    const text = `📎 Attached: ${s.uploadedCount}\nTap a button when you’re finished.`;
    const kb = this.imagesControlKeyboard(s.listingId);
    const sent = await botApi.sendMessage(chatId, text, kb);
    s.controlMsgId = (sent as any).message_id;
    this.sessions.set(chatId, s);
  }

  /** Buffer albums while in awaiting_images (debounce → single counter update). */
  private bufferAwaitingImageGroup(
    mediaGroupId: string,
    payload: AwaitingGroupBucket,
  ) {
    let bucket = this.awaitingImgGroups.get(mediaGroupId);
    if (!bucket) {
      bucket = {
        chatId: payload.chatId,
        listingId: payload.listingId,
        items: [],
      };
      this.awaitingImgGroups.set(mediaGroupId, bucket);
    }
    bucket.items.push(...payload.items);

    if (bucket.timer) clearTimeout(bucket.timer);
    bucket.timer = setTimeout(async () => {
      this.awaitingImgGroups.delete(mediaGroupId);
      const s = this.sessions.get(bucket.chatId);
      if (
        !s ||
        s.mode !== 'awaiting_images' ||
        s.listingId !== bucket.listingId
      )
        return;

      s.pending.push(...bucket.items);
      s.uploadedCount += bucket.items.length;
      this.sessions.set(bucket.chatId, s);
      await this.postFreshCounterMessage(bucket.chatId, s);
    }, 1500);
  }

  // merge & clear any album buffers for this chat/listing (used on I’m done / discard)
  private flushAwaitingGroupBuffers(
    chatId: number,
    listingId: string,
    sess: Extract<Session, { mode: 'awaiting_images' }>,
    mergeIntoPending: boolean = true,
  ) {
    for (const [key, bucket] of this.awaitingImgGroups) {
      if (bucket.chatId === chatId && bucket.listingId === listingId) {
        if (bucket.timer) clearTimeout(bucket.timer);
        this.awaitingImgGroups.delete(key);
        if (mergeIntoPending && bucket.items.length) {
          sess.pending.push(...bucket.items);
          sess.uploadedCount += bucket.items.length;
        }
      }
    }
    // make sure UI shows the final count if we merged anything
    if (mergeIntoPending) {
      this.sessions.set(chatId, sess);
    }
  }

  // ---------- quick album flow ----------

  private bufferQuickAlbum(
    mediaGroupId: string,
    payload: {
      chatId: number;
      fromUserId: number;
      fromUsername?: string | null;
      fromDisplayName?: string | null;
      items: IntakeMediaInput[];
      caption?: string | null;
    },
  ) {
    let bucket = this.quickAlbums.get(mediaGroupId);
    if (!bucket) {
      bucket = {
        chatId: payload.chatId,
        fromUserId: payload.fromUserId,
        fromUsername: payload.fromUsername ?? null,
        fromDisplayName: payload.fromDisplayName ?? null,
        items: [],
        caption: payload.caption ?? null,
      };
      this.quickAlbums.set(mediaGroupId, bucket);
    }
    bucket.items.push(...payload.items);
    if (payload.caption && !bucket.caption) bucket.caption = payload.caption;

    if (bucket.timer) clearTimeout(bucket.timer);
    bucket.timer = setTimeout(
      () => this.finalizeQuickAlbum(mediaGroupId).catch(() => {}),
      1500,
    );
  }

  private async finalizeQuickAlbum(mediaGroupId: string) {
    const bot = this.runtime.getBot();
    const bucket = this.quickAlbums.get(mediaGroupId);
    if (!bucket) return;
    this.quickAlbums.delete(mediaGroupId);

    const text = bucket.caption ?? '(no caption)';
    const baseMsgId = bucket.items[0]?.tgMessageId ?? Date.now();

    try {
      const listingId = await this.intake.createDraftListingFromText({
        chatId: bucket.chatId,
        fromUserId: bucket.fromUserId,
        fromUsername: bucket.fromUsername ?? null,
        fromDisplayName: bucket.fromDisplayName ?? null,
        tgMessageId: baseMsgId,
        text,
      });

      for (const it of bucket.items)
        await this.intake.saveListingMedia(listingId, it);

      await bot.telegram.sendMessage(
        bucket.chatId,
        `✅ Saved (${bucket.items.length} media)`,
      );
      this.sessions.set(bucket.chatId, { mode: 'idle' });
    } catch (e: any) {
      try {
        if (
          String(e?.message) === 'DUPLICATE_POST' ||
          String(e?.message) === 'DUPLICATE_TITLE'
        ) {
          await bot.telegram.sendMessage(
            bucket.chatId,
            '⚠️ This post already exists in the system.',
          );
        } else {
          await bot.telegram.sendMessage(
            bucket.chatId,
            '❌ Could not save the post.',
          );
        }
      } catch {}
    }
  }

  // ---------- display helpers ----------

  private async listMyAdsForChat(chatId: number, tgUserId: number) {
    const bot = this.runtime.getBot();
    const rows = await this.intake.listRecentDraftsForTelegramUser(tgUserId, 5);
    if (!rows.length) {
      return bot.telegram.sendMessage(
        chatId,
        '📂 No ads yet. Use “Post Ad ➕” to create one!',
      );
    }

    for (const l of rows) {
      const { media } = await this.intake.getListingWithMedia(l.id);
      const caption = this.intake.buildListingCaption(l);

      if (!media.length) {
        await bot.telegram.sendMessage(chatId, caption, {
          parse_mode: 'HTML',
          // depending on telegraf version, this may be typed loosely
          // @ts-ignore
          link_preview_options: { is_disabled: true },
        });
      } else {
        const group = media.map((m, idx) =>
          m.kind === MediaKind.PHOTO
            ? {
                type: 'photo',
                media: m.tgFileId,
                ...(idx === 0 ? { caption, parse_mode: 'HTML' as const } : {}),
              }
            : {
                type: 'document',
                media: m.tgFileId,
                ...(idx === 0 ? { caption, parse_mode: 'HTML' as const } : {}),
              },
        );
        await bot.telegram.sendMediaGroup(chatId, group as any);
      }

      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

// tiny helper for doc single in quick flow
function itemFromDoc(
  d: any,
  caption: string | null,
  msgId: number,
): IntakeMediaInput {
  return {
    kind: 'document',
    tgFileId: d.file_id,
    tgFileUniqueId: d.file_unique_id,
    fileName: d.file_name ?? null,
    mimeType: d.mime_type ?? null,
    fileSize: d.file_size ?? null,
    tgMessageId: msgId,
    caption: caption ?? undefined,
  };
}
