import { Markup, Telegraf } from 'telegraf';
import {
  ListingIntakeService,
  IntakeMediaInput,
} from 'src/modules/listing-intake/listing-intake.service';
import { TelegramBotService } from 'src/modules/telegram/telegram-bot.service';
import { ACTIONS } from '../constants';
import { Session, AwaitingGroupBucket, QuickAlbumBucket } from '../types';
import { imagesControlKeyboard } from '../keyboard';

export function registerPostQuickFlow(
  bot: Telegraf,
  runtime: TelegramBotService,
  sessions: Map<number, Session>,
  intake: ListingIntakeService,
) {
  // --- state for this flow
  const awaitingImgGroups = new Map<string, AwaitingGroupBucket>(); // for albums during awaiting_images
  const quickAlbums = new Map<string, QuickAlbumBucket>(); // for album-first quick flow

  // choose quick
  bot.action(ACTIONS.CHOOSE_QUICK as any, async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch {}
    sessions.set(ctx.chat!.id, { mode: 'awaiting_text_quick' });
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

  // choose guided (placeholder)
  bot.action(ACTIONS.CHOOSE_GUIDED as any, async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch {}
    await ctx.editMessageText('🧠 Guided mode coming next.');
  });

  // TEXT (strict gating)
  bot.on('text', async (ctx) => {
    const s = sessions.get(ctx.chat.id);

    // If user isn't in the quick-post text step, guide them into the flow instead of ignoring.
    if (s?.mode !== 'awaiting_text_quick') {
      const raw = ctx.message.text || '';

      // avoid double-message if they typed the menu label or used /post
      if (raw === 'Post Ad ➕' || raw.startsWith('/post')) return;

      return ctx.replyWithHTML(
        [
          'ℹ️ <b>Heads up:</b> sending text here won’t create a post.',
          '',
          'To post an ad:',
          '1) Tap <b>Post Ad ➕</b> below,',
          '2) Choose <b>Paste/Forward Ad ⚡</b>,',
          '3) Send your ad text and (optionally) add photos.',
        ].join('\n'),
      );
    }

    const text = ctx.message.text?.trim() ?? '';
    if (!text) return ctx.reply('Please send some text.');

    try {
      const listingId = await intake.createDraftListingFromText({
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
      sessions.set(ctx.chat.id, { mode: 'idle' });
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

  // add pics / skip
  bot.action(new RegExp(`^${ACTIONS.ADDPICS_PREFIX}(.+)$`), async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch {}
    const listingId = ctx.match?.[1];
    if (!listingId) return;

    sessions.set(ctx.chat!.id, {
      mode: 'awaiting_images',
      listingId,
      uploadedCount: 0,
      pending: [],
    });

    try {
      await ctx.editMessageText('📷 Please select photos (multiple allowed).');
    } catch {
      await ctx.reply('📷 Please select photos (multiple allowed).');
    }
  });

  bot.action(new RegExp(`^${ACTIONS.SKIP_PREFIX}(.+)$`), async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch {}
    sessions.set(ctx.chat!.id, { mode: 'idle' });
    try {
      await ctx.editMessageText('✅ Saved! Your post is ready.');
    } catch {
      await ctx.reply('✅ Saved! Your post is ready.');
    }
  });

  // ----- control card actions -----
  bot.action(new RegExp(`^${ACTIONS.IMGDONE_PREFIX}(.+)$`), async (ctx) => {
    try {
      await ctx.answerCbQuery('Done.');
    } catch {}
    const listingId = ctx.match?.[1];

    const sess = sessions.get(ctx.chat!.id);
    if (
      !sess ||
      sess.mode !== 'awaiting_images' ||
      sess.listingId !== listingId
    )
      return;

    flushAwaitingGroupBuffers(awaitingImgGroups, ctx.chat!.id, listingId, sess);

    const controlMsgId = sess.controlMsgId;
    const items = sess.pending.slice();
    let saved = 0,
      failed = 0;

    for (const it of items) {
      try {
        await intake.saveListingMedia(listingId, it);
        saved++;
      } catch {
        failed++;
      }
    }

    sessions.set(ctx.chat!.id, { mode: 'idle' });

    const summary = failed
      ? `✅ Saved! (${saved} added, ${failed} failed)`
      : `✅ Saved! (${saved} added)`;
    const botApi = runtime.getBot().telegram;
    if (controlMsgId) {
      try {
        await botApi.deleteMessage(ctx.chat!.id, controlMsgId);
      } catch {}
    }
    await ctx.reply(summary);
  });

  bot.action(new RegExp(`^${ACTIONS.IMGDISCARD_PREFIX}(.+)$`), async (ctx) => {
    try {
      await ctx.answerCbQuery('Continuing without photos');
    } catch {}
    const listingId = ctx.match?.[1];
    const sess = sessions.get(ctx.chat!.id);
    if (
      !sess ||
      sess.mode !== 'awaiting_images' ||
      sess.listingId !== listingId
    )
      return;

    flushAwaitingGroupBuffers(
      awaitingImgGroups,
      ctx.chat!.id,
      listingId,
      sess,
      false,
    );

    const controlMsgId = sess.controlMsgId;
    sessions.set(ctx.chat!.id, { mode: 'idle' });

    const botApi = runtime.getBot().telegram;
    if (controlMsgId) {
      try {
        await botApi.deleteMessage(ctx.chat!.id, controlMsgId);
      } catch {}
    }
    await ctx.reply('↩️ Continued without photos.');
  });

  bot.action(new RegExp(`^${ACTIONS.IMGMORE_PREFIX}(.+)$`), async (ctx) => {
    try {
      await ctx.answerCbQuery('Select more…');
    } catch {}
    const sess = sessions.get(ctx.chat!.id);
    if (!sess || sess.mode !== 'awaiting_images') return;

    const text = `📷 Select more photos…\n📎 Currently attached: ${sess.uploadedCount}`;
    const kb = imagesControlKeyboard(sess.listingId);

    const botApi = runtime.getBot().telegram;
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

  // ----- media handlers -----
  bot.on('photo', async (ctx) => {
    const s = sessions.get(ctx.chat.id);
    if (s?.mode !== 'awaiting_images' && s?.mode !== 'awaiting_text_quick') {
      return ctx.reply(
        'ℹ️ Please start from “Post Ad ➕ → Paste/Forward Ad ⚡”.',
      );
    }

    const photos = ctx.message.photo;
    const best = photos[photos.length - 1];
    const mediaGroupId = ctx.message.media_group_id as string | undefined;
    const caption = ctx.message.caption ?? null;

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
        bufferAwaitingImageGroup(
          awaitingImgGroups,
          mediaGroupId,
          {
            chatId: ctx.chat.id,
            listingId: s.listingId,
            items: [item],
          },
          sessions,
          runtime,
        );
      } else {
        s.pending.push(item);
        s.uploadedCount += 1;
        sessions.set(ctx.chat.id, s);
        await postFreshCounterMessage(runtime, ctx.chat.id, s);
      }
      return;
    }

    // quick flow (album before text)
    if (mediaGroupId) {
      bufferQuickAlbum(
        quickAlbums,
        mediaGroupId,
        {
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
        },
        intake,
        sessions,
        runtime,
      );
    } else {
      const text = caption ?? '(no caption)';
      try {
        const listingId = await intake.createDraftListingFromText({
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
        await intake.saveListingMedia(listingId, {
          kind: 'photo',
          tgFileId: best.file_id,
          tgFileUniqueId: best.file_unique_id,
          width: best.width,
          height: best.height,
          fileSize: best.file_size ?? null,
          tgMessageId: ctx.message.message_id,
        });
        await ctx.reply('✅ Saved (photo post).');
        sessions.set(ctx.chat.id, { mode: 'idle' });
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

  bot.on('document', async (ctx) => {
    const s = sessions.get(ctx.chat.id);
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
        bufferAwaitingImageGroup(
          awaitingImgGroups,
          mediaGroupId,
          {
            chatId: ctx.chat.id,
            listingId: s.listingId,
            items: [item],
          },
          sessions,
          runtime,
        );
      } else {
        s.pending.push(item);
        s.uploadedCount += 1;
        sessions.set(ctx.chat.id, s);
        await postFreshCounterMessage(runtime, ctx.chat.id, s);
      }
      return;
    }

    if (!mediaGroupId) {
      const text = caption ?? '(no caption)';
      try {
        const listingId = await intake.createDraftListingFromText({
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
        await intake.saveListingMedia(listingId, {
          kind: 'document',
          tgFileId: d.file_id,
          tgFileUniqueId: d.file_unique_id,
          fileName: d.file_name ?? null,
          mimeType: d.mime_type ?? null,
          fileSize: d.file_size ?? null,
          tgMessageId: ctx.message.message_id,
        });
        await ctx.reply('✅ Saved (document post).');
        sessions.set(ctx.chat.id, { mode: 'idle' });
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
      bufferQuickAlbum(
        quickAlbums,
        mediaGroupId,
        {
          chatId: ctx.chat.id,
          fromUserId: ctx.from?.id ?? 0,
          fromUsername: ctx.from?.username ?? null,
          fromDisplayName:
            [ctx.from?.first_name, ctx.from?.last_name]
              .filter(Boolean)
              .join(' ') || null,
          items: [itemFromDoc(d, caption, ctx.message.message_id)],
          caption,
        },
        intake,
        sessions,
        runtime,
      );
    }
  });
}

/* ---------- helpers for this flow ---------- */

async function postFreshCounterMessage(
  runtime: TelegramBotService,
  chatId: number,
  s: Extract<Session, { mode: 'awaiting_images' }>,
) {
  const botApi = runtime.getBot().telegram;

  if (s.controlMsgId) {
    try {
      await botApi.deleteMessage(chatId, s.controlMsgId);
    } catch {}
    s.controlMsgId = undefined;
  }

  const text = `📎 Attached: ${s.uploadedCount}\nTap a button when you’re finished.`;
  const kb = imagesControlKeyboard(s.listingId);
  const sent = await botApi.sendMessage(chatId, text, kb);
  s.controlMsgId = (sent as any).message_id;
}

function bufferAwaitingImageGroup(
  awaitingImgGroups: Map<string, AwaitingGroupBucket>,
  mediaGroupId: string,
  payload: AwaitingGroupBucket,
  sessions: Map<number, Session>,
  runtime: TelegramBotService,
) {
  let bucket = awaitingImgGroups.get(mediaGroupId);
  if (!bucket) {
    bucket = {
      chatId: payload.chatId,
      listingId: payload.listingId,
      items: [],
    };
    awaitingImgGroups.set(mediaGroupId, bucket);
  }
  bucket.items.push(...payload.items);

  if (bucket.timer) clearTimeout(bucket.timer);
  bucket.timer = setTimeout(async () => {
    awaitingImgGroups.delete(mediaGroupId);
    const s = sessions.get(bucket.chatId);
    if (!s || s.mode !== 'awaiting_images' || s.listingId !== bucket.listingId)
      return;

    s.pending.push(...bucket.items);
    s.uploadedCount += bucket.items.length;
    sessions.set(bucket.chatId, s);
    await postFreshCounterMessage(runtime, bucket.chatId, s);
  }, 1500);
}

function flushAwaitingGroupBuffers(
  awaitingImgGroups: Map<string, AwaitingGroupBucket>,
  chatId: number,
  listingId: string,
  sess: Extract<Session, { mode: 'awaiting_images' }>,
  mergeIntoPending: boolean = true,
) {
  for (const [key, bucket] of awaitingImgGroups) {
    if (bucket.chatId === chatId && bucket.listingId === listingId) {
      if (bucket.timer) clearTimeout(bucket.timer);
      awaitingImgGroups.delete(key);
      if (mergeIntoPending && bucket.items.length) {
        sess.pending.push(...bucket.items);
        sess.uploadedCount += bucket.items.length;
      }
    }
  }
}

function bufferQuickAlbum(
  quickAlbums: Map<string, QuickAlbumBucket>,
  mediaGroupId: string,
  payload: QuickAlbumBucket,
  intake: ListingIntakeService,
  sessions: Map<number, Session>,
  runtime: TelegramBotService,
) {
  let bucket = quickAlbums.get(mediaGroupId);
  if (!bucket) {
    bucket = {
      chatId: payload.chatId,
      fromUserId: payload.fromUserId,
      fromUsername: payload.fromUsername ?? null,
      fromDisplayName: payload.fromDisplayName ?? null,
      items: [],
      caption: payload.caption ?? null,
    };
    quickAlbums.set(mediaGroupId, bucket);
  }
  bucket.items.push(...payload.items);
  if (payload.caption && !bucket.caption) bucket.caption = payload.caption;

  if (bucket.timer) clearTimeout(bucket.timer);
  bucket.timer = setTimeout(
    () =>
      finalizeQuickAlbum(
        quickAlbums,
        mediaGroupId,
        intake,
        sessions,
        runtime,
      ).catch(() => {}),
    1500,
  );
}

async function finalizeQuickAlbum(
  quickAlbums: Map<string, QuickAlbumBucket>,
  mediaGroupId: string,
  intake: ListingIntakeService,
  sessions: Map<number, Session>,
  runtime: TelegramBotService,
) {
  const bot = runtime.getBot();
  const bucket = quickAlbums.get(mediaGroupId);
  if (!bucket) return;
  quickAlbums.delete(mediaGroupId);

  const text = bucket.caption ?? '(no caption)';
  const baseMsgId = bucket.items[0]?.tgMessageId ?? Date.now();

  try {
    const listingId = await intake.createDraftListingFromText({
      chatId: bucket.chatId,
      fromUserId: bucket.fromUserId,
      fromUsername: bucket.fromUsername ?? null,
      fromDisplayName: bucket.fromDisplayName ?? null,
      tgMessageId: baseMsgId,
      text,
    });

    for (const it of bucket.items) await intake.saveListingMedia(listingId, it);

    await bot.telegram.sendMessage(
      bucket.chatId,
      `✅ Saved (${bucket.items.length} media)`,
    );
    sessions.set(bucket.chatId, { mode: 'idle' });
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
