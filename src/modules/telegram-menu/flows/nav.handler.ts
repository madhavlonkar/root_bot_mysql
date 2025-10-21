import { Markup, Telegraf } from 'telegraf';
import { MENU } from '../constants';
import { Session } from '../types';
import { ListingIntakeService } from 'src/modules/listing-intake/listing-intake.service';
import { MediaKind } from 'src/common/enums/flats.enum';
import { postChooserKeyboard } from '../keyboard'; // ⬅️ add this

export function registerNavHandlers(
  bot: Telegraf,
  sessions: Map<number, Session>,
  intake: ListingIntakeService,
) {
  // /start + main keyboard
  bot.start(async (ctx) => {
    sessions.set(ctx.chat.id, { mode: 'idle' });
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

  // Commands mirror the keyboard
  bot.command('browse', (ctx) => showBrowse(ctx));
  bot.command('post', (ctx) => showPostHelp(ctx)); // shows chooser
  bot.command('myads', (ctx) => showMyAds(ctx, intake));
  bot.command('wishlist', (ctx) => showWishlist(ctx));
  bot.command('boosted', (ctx) => showBoosted(ctx));
  bot.command('credits', (ctx) => showCredits(ctx));
  bot.command('support', (ctx) => showSupport(ctx));

  bot.hears(MENU.BROWSE, (ctx) => showBrowse(ctx));
  bot.hears(MENU.POST, (ctx) => showPostHelp(ctx)); // shows chooser
  bot.hears(MENU.MY_ADS, (ctx) => showMyAds(ctx, intake));
  bot.hears(MENU.WISHLIST, (ctx) => showWishlist(ctx));
  bot.hears(MENU.BOOSTED, (ctx) => showBoosted(ctx));
  bot.hears(MENU.CREDITS, (ctx) => showCredits(ctx));
  bot.hears(MENU.SUPPORT, (ctx) => showSupport(ctx));
}

export function showPostHelp(ctx: any) {
  ctx.scene?.leave?.();
  // ⬇️ send the chooser *with* inline keyboard
  ctx.replyWithHTML(
    [
      `🧩 <b>Create an Ad</b>`,
      `Choose how you want to create your ad:`,
      `• <b>Paste/Forward Ad ⚡</b> from the next screen and add photos if you want.`,
      `• <b>Guided: Answer Questions 🧠</b> (coming soon).`,
    ].join('\n'),
    postChooserKeyboard(), // <-- add buttons here
  );
}

export async function showBrowse(ctx: any) {
  await ctx.replyWithHTML(`🏠 <b>Browse</b>\nComing soon ✨`);
}
export async function showBoosted(ctx: any) {
  await ctx.replyWithHTML(`🔝 <b>Boosted</b>\nNo boosted listings yet.`);
}
export async function showWishlist(ctx: any) {
  await ctx.replyWithHTML(`⭐ <b>Wishlist</b>\nFeature coming soon!`);
}
export async function showCredits(ctx: any) {
  await ctx.replyWithHTML(`💳 <b>Credits</b>\nLaunching shortly.`);
}
export async function showSupport(ctx: any) {
  await ctx.replyWithHTML(
    `🛟 <b>Support</b>\nMessage here or email <i>support@roombot.local</i>.`,
  );
}

export async function showMyAds(ctx: any, intake: ListingIntakeService) {
  const rows = await intake.listRecentDraftsForTelegramUser(
    ctx.from?.id ?? 0,
    5,
  );
  if (!rows.length)
    return ctx.reply('📂 No ads yet. Use “Post Ad ➕” to create one!');

  for (const l of rows) {
    const { media } = await intake.getListingWithMedia(l.id);
    const caption = intake.buildListingCaption(l);

    if (!media.length) {
      await ctx.reply(caption, {
        parse_mode: 'HTML',
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
      await ctx.telegram.sendMediaGroup(ctx.chat.id, group as any);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}
