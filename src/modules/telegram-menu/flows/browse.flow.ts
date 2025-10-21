// src/modules/telegram-menu/flows/browse.flow.ts
import { Markup, Telegraf } from 'telegraf';
import { TelegramBotService } from 'src/modules/telegram/telegram-bot.service';
import { ListingIntakeService } from 'src/modules/listing-intake/listing-intake.service';
import { ListingService } from 'src/modules/listings/listing.service'; // NEW
import { ACTIONS } from '../constants';
import {
  browseBudgetKeyboard,
  browseMainKeyboard,
  browseTypeKeyboard,
} from '../keyboard';
import { Session } from '../types';
import { MediaKind } from 'src/common/enums/flats.enum';

type Sessions = Map<number, Session>;

const PAGE_SIZE = 5;
const CAP = 10; // last 10 only

export function registerBrowseFlow(
  bot: Telegraf,
  runtime: TelegramBotService,
  sessions: Sessions,
  intake: ListingIntakeService,
  listingSvc: ListingService, // ← NEW param
) {
  /** Show the Browse main menu */
  bot.action(ACTIONS.BROWSE_MAIN as any, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    return showBrowseMenu(ctx);
  });

  /** 🔎 Search by Area */
  bot.action(ACTIONS.BROWSE_AREA as any, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const s = sessions.get(ctx.chat!.id) || { mode: 'idle' };
    (s as any).browse = { step: 'await_area' };
    sessions.set(ctx.chat!.id, s);
    await ctx.replyWithHTML(
      '📍 <b>Search by Area</b>\nType an area/locality (e.g. <i>Powai</i>, <i>Baner</i>, <i>Koramangala</i>).',
    );
  });

  /** 🆕 Latest Listings (real) — page 0 */
  bot.action(ACTIONS.BROWSE_LATEST as any, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    return showLatestPage(ctx, intake, listingSvc, 0);
  });

  /** 🆕 Latest Listings — go to page N via action */
  bot.action(
    new RegExp(`^${ACTIONS.BROWSE_LATEST_PAGE_PREFIX}(\\d+)$`),
    async (ctx) => {
      await ctx.answerCbQuery().catch(() => {});
      const page = Math.max(0, parseInt(ctx.match[1], 10) || 0);
      return showLatestPage(ctx, intake, listingSvc, page);
    },
  );

  bot.action(new RegExp(`^${ACTIONS.UI_NOP_PREFIX}(.*)$`), async (ctx) => {
    const kind = (ctx.match[1] || '').split(':')[0];
    await ctx
      .answerCbQuery(
        kind === 'first'
          ? 'You are on the first page.'
          : kind === 'last'
            ? 'You are on the last page.'
            : 'Page info',
      )
      .catch(() => {});
  });

  /** 💰 Browse by Budget -> show ranges */
  bot.action(ACTIONS.BROWSE_BUDGET as any, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await ctx.replyWithHTML(
      '💰 <b>Select your budget range:</b>',
      browseBudgetKeyboard(),
    );
  });

  // 💰 Budget - chosen range (stub)
  bot.action(
    new RegExp(`^${ACTIONS.BROWSE_BUDGET_PREFIX}(.+)$`),
    async (ctx) => {
      await ctx.answerCbQuery().catch(() => {});
      const range = ctx.match[1]; // "<10", "10-20", "20-40", ">40"
      const display = escapeHtml(humanizeBudget(range));
      await ctx.replyWithHTML(
        `🔎 Searching listings for budget: <b>${display}</b>\n(coming soon)`,
      );
    },
  );

  /** 🏡 Browse by Property Type -> show types */
  bot.action(ACTIONS.BROWSE_TYPE as any, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await ctx.replyWithHTML(
      '🏡 <b>Select property type:</b>',
      browseTypeKeyboard(),
    );
  });

  /** 🏡 Type - chosen (stub) */
  bot.action(new RegExp(`^${ACTIONS.BROWSE_TYPE_PREFIX}(.+)$`), async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const type = ctx.match[1];
    await ctx.replyWithHTML(
      `🔎 Searching listings for type: <b>${typeLabel(type)}</b>\n(coming soon)`,
    );
  });

  /** TEXT HANDLER for "Search by Area" (unchanged) */
  bot.on('text', async (ctx, next) => {
    const s = sessions.get(ctx.chat.id);
    const isBrowseArea = s && (s as any).browse?.step === 'await_area';
    if (!isBrowseArea) return next?.();

    const area = (ctx.message.text || '').trim();
    if (!area) return;

    (s as any).browse = { step: 'idle' };
    sessions.set(ctx.chat.id, s);

    await ctx.replyWithHTML(
      `📍 <b>${escapeHtml(area)}</b>\n(coming soon) — we’ll show top results here with Next ➡️ / Save ⭐ / Contact 📞 buttons.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('◀️ Back to Browse', ACTIONS.BROWSE_MAIN)],
      ]),
    );
  });
}

function buildPagerRow(
  page: number,
  pages: number,
  hasPrev: boolean,
  hasNext: boolean,
) {
  const prevBtn = hasPrev
    ? Markup.button.callback(
        '◀️ Prev',
        ACTIONS.BROWSE_LATEST_PAGE_PREFIX + (page - 1),
      )
    : Markup.button.callback('◀️ Prev', ACTIONS.UI_NOP_PREFIX + 'first');

  const infoBtn = Markup.button.callback(
    `Page ${page + 1} of ${pages}`,
    ACTIONS.UI_NOP_PREFIX + 'info',
  );

  const nextBtn = hasNext
    ? Markup.button.callback(
        'Next ▶️',
        ACTIONS.BROWSE_LATEST_PAGE_PREFIX + (page + 1),
      )
    : Markup.button.callback('Next ▶️', ACTIONS.UI_NOP_PREFIX + 'last');

  return [prevBtn, infoBtn, nextBtn];
}

/** Show the Latest Listings page */
async function showLatestPage(
  ctx: any,
  intake: ListingIntakeService,
  listingSvc: ListingService,
  page: number,
) {
  const skip = page * PAGE_SIZE;
  const { items, total, pages, hasPrev, hasNext } =
    await listingSvc.listLatestPublicByPostedAt(skip, PAGE_SIZE, CAP);

  if (!items.length) {
    return ctx.replyWithHTML(
      '🆕 No public listings yet.',
      Markup.inlineKeyboard([
        [Markup.button.callback('◀️ Back', ACTIONS.BROWSE_MAIN)],
      ]),
    );
  }

  // Send listings (unchanged)
  for (const l of items) {
    const { media } = await intake.getListingWithMedia(l.id);
    const caption = intake.buildListingCaption(l);
    if (!media?.length) {
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

  // Simple, inline pager (single row), plus Back below it
  const rows = [
    buildPagerRow(page, pages, hasPrev, hasNext),
    [Markup.button.callback('◀️ Back', ACTIONS.BROWSE_MAIN)],
  ];
  await ctx.reply(`Page ${page + 1} of ${pages}`, Markup.inlineKeyboard(rows));
}

/** Public helper to show the Browse menu */
export async function showBrowseMenu(ctx: any) {
  await ctx.replyWithHTML(
    `🏠 <b>Browse Listings</b>\nWhat would you like to do?`,
    browseMainKeyboard(),
  );
}

/** utils (unchanged) */
function humanizeBudget(tag: string) {
  if (tag === '<10') return '< ₹10K';
  if (tag === '>40') return '> ₹40K';
  if (tag === '10-20') return '₹10K–₹20K';
  if (tag === '20-40') return '₹20K–₹40K';
  return tag;
}
function typeLabel(t: string) {
  return (
    (
      { '1rk': '1RK', '1bhk': '1BHK', '2bhk': '2BHK', pg: 'PG/Coliving' } as any
    )[t] || t
  );
}
function escapeHtml(s: string) {
  return s.replace(
    /[&<>]/g,
    (c) => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }) as any)[c],
  );
}
