// src/modules/telegram-menu/flows/browse.flow.ts
import { Markup, Telegraf } from 'telegraf';
import { TelegramBotService } from 'src/modules/telegram/telegram-bot.service';
import { ListingIntakeService } from 'src/modules/listing-intake/listing-intake.service';
import { ACTIONS } from '../constants';
import {
  browseBudgetKeyboard,
  browseMainKeyboard,
  browseTypeKeyboard,
} from '../keyboard';
import { Session } from '../types';

type Sessions = Map<number, Session>;

export function registerBrowseFlow(
  bot: Telegraf,
  runtime: TelegramBotService,
  sessions: Sessions,
  intake: ListingIntakeService,
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

  /** 🆕 Latest Listings (stub) */
  bot.action(ACTIONS.BROWSE_LATEST as any, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    // TODO: replace with intake.getLatestPublicListings(limit)
    await ctx.replyWithHTML(
      '🆕 <b>Latest Listings</b>\n(coming soon) — we’ll show the newest 5 listings here.',
    );
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

      // Escape only the variable part to keep HTML formatting safe
      const display = escapeHtml(humanizeBudget(range));

      // TODO: call intake.searchByBudget(range)
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
    const type = ctx.match[1]; // "1rk" | "1bhk" | "2bhk" | "pg"
    // TODO: call intake.searchByType(type)
    await ctx.replyWithHTML(
      `🔎 Searching listings for type: <b>${typeLabel(type)}</b>\n(coming soon)`,
    );
  });

  /** TEXT HANDLER for "Search by Area" */
  bot.on('text', async (ctx, next) => {
    const s = sessions.get(ctx.chat.id);
    const isBrowseArea = s && (s as any).browse?.step === 'await_area';
    if (!isBrowseArea) return next?.();

    const area = (ctx.message.text || '').trim();
    if (!area) return;

    // reset state
    (s as any).browse = { step: 'idle' };
    sessions.set(ctx.chat.id, s);

    // TODO: replace with: const listings = await intake.searchByArea(area, 5);
    await ctx.replyWithHTML(
      `📍 <b>${escapeHtml(area)}</b>\n(coming soon) — we’ll show top results here with Next ➡️ / Save ⭐ / Contact 📞 buttons.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('◀️ Back to Browse', ACTIONS.BROWSE_MAIN)],
      ]),
    );
  });
}

/** Public helper to show the Browse menu (used by nav.handler.ts) */
export async function showBrowseMenu(ctx: any) {
  await ctx.replyWithHTML(
    `🏠 <b>Browse Listings</b>\nWhat would you like to do?`,
    browseMainKeyboard(),
  );
}

/** utils */
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
