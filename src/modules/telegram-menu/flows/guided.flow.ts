import { Telegraf } from 'telegraf';
import { TelegramBotService } from 'src/modules/telegram/telegram-bot.service';
import { ListingIntakeService } from 'src/modules/listing-intake/listing-intake.service';
import { ACTIONS } from '../constants';
import { Session, GuidedDraft, Step } from '../types';
import {
  guidedTypeAudienceKeyboard,
  guidedRulesKeyboard,
  guidedConfirmKeyboard,
  guidedRentKeyboard,
  guidedDepositKeyboard,
  guidedFurnishingKeyboard,
} from '../keyboard';
import { Audience } from 'src/common/enums/audience.enum';
import { FurnishedType, UnitType } from 'src/common/enums/flats.enum';

export function registerGuidedFlow(
  bot: Telegraf,
  runtime: TelegramBotService,
  sessions: Map<number, Session>,
  intake: ListingIntakeService,
) {
  /* enter guided */
  bot.action(ACTIONS.CHOOSE_GUIDED as any, async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch {}
    const draft: GuidedDraft = {
      furnished: FurnishedType.UNFURNISHED,
      restrictions: true,
      bachelorsAllowed: true,
      petsAllowed: true,
      parkingAvailable: true,
      couplesAllowed: false,
    };
    sessions.set(ctx.chat!.id, { mode: 'guided', step: Step.TYPE_AUD, draft });
    const sent = await ctx.replyWithHTML(
      '🍀 <b>Create an Ad (Guided)</b>\nPick the <b>type</b> and <b>audience</b>.',
      guidedTypeAudienceKeyboard(draft),
    );
    const s = sessions.get(ctx.chat!.id);
    if (s && s.mode === 'guided') s.controlMsgId = (sent as any).message_id;
  });

  /* step 1 picks */
  bot.action(new RegExp(`^${ACTIONS.G_UNIT_PREFIX}(.+)$`), async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch {}
    const s = sessions.get(ctx.chat!.id);
    if (!s || s.mode !== 'guided' || s.step !== Step.TYPE_AUD) return;
    s.draft.unitType = ctx.match![1] as UnitType;
    await redrawTypeAudCard(ctx, s);
  });

  bot.action(new RegExp(`^${ACTIONS.G_AUD_PREFIX}(.+)$`), async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch {}
    const s = sessions.get(ctx.chat!.id);
    if (!s || s.mode !== 'guided' || s.step !== Step.TYPE_AUD) return;
    s.draft.audience = ctx.match![1] as Audience;
    await redrawTypeAudCard(ctx, s);
  });

  /* generic Next */
  bot.action(ACTIONS.G_NEXT as any, async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch {}
    const s = sessions.get(ctx.chat!.id);
    if (!s || s.mode !== 'guided') return;

    if (s.step === Step.TYPE_AUD) {
      if (!s.draft.unitType || !s.draft.audience) return;
      s.step = Step.LOCATION;
      return replaceCard(
        ctx,
        s,
        '📍 <b>Location</b>\nSend area/locality and city (e.g. <i>Powai, Mumbai</i>).',
      );
    }

    if (s.step === Step.BUDGET_FURN && s.bfStage === 'furn') {
      s.step = Step.RULES;
      return replaceCard(
        ctx,
        s,
        '⚙️ <b>Rules</b>\nToggle what applies, then Next.',
        guidedRulesKeyboard(s.draft),
      );
    }

    if (s.step === Step.RULES) {
      s.step = Step.DETAILS;
      return replaceCard(
        ctx,
        s,
        '📝 <b>Description & Contact</b>\nSend description. You can add a phone/email too.',
      );
    }
  });

  /* cancel */
  bot.action(ACTIONS.G_CANCEL as any, async (ctx) => {
    try {
      await ctx.answerCbQuery('Cancelled');
    } catch {}
    const s = sessions.get(ctx.chat!.id);
    if (!s || s.mode !== 'guided') return;
    if (s.controlMsgId) {
      try {
        await runtime
          .getBot()
          .telegram.deleteMessage(ctx.chat!.id, s.controlMsgId);
      } catch {}
    }
    sessions.set(ctx.chat!.id, { mode: 'idle' });
    await ctx.reply('❌ Cancelled.');
  });

  /* rules toggles */
  bot.action(new RegExp(`^${ACTIONS.G_RULE_PREFIX}(.+)$`), async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch {}
    const s = sessions.get(ctx.chat!.id);
    if (!s || s.mode !== 'guided' || s.step !== Step.RULES) return;
    const key = ctx.match![1] as
      | 'couples'
      | 'bachelors'
      | 'pets'
      | 'parking'
      | 'restrictions';
    if (key === 'couples') s.draft.couplesAllowed = !s.draft.couplesAllowed;
    if (key === 'bachelors')
      s.draft.bachelorsAllowed = !s.draft.bachelorsAllowed;
    if (key === 'pets') s.draft.petsAllowed = !s.draft.petsAllowed;
    if (key === 'parking') s.draft.parkingAvailable = !s.draft.parkingAvailable;
    if (key === 'restrictions') s.draft.restrictions = !s.draft.restrictions;
    await redrawRulesCard(ctx, s);
  });

  /* save */
  bot.action(ACTIONS.G_SAVE as any, async (ctx) => {
    try {
      await ctx.answerCbQuery('Saving…');
    } catch {}
    const s = sessions.get(ctx.chat!.id);
    if (!s || s.mode !== 'guided' || s.step !== Step.CONFIRM) return;
    const finalDraft = finalizeDraftForSave(s.draft);
    try {
      const listingId = await intake.createDraftListingFromGuided({
        chatId: ctx.chat!.id,
        fromUserId: ctx.from?.id ?? 0,
        fromUsername: ctx.from?.username ?? null,
        fromDisplayName:
          [ctx.from?.first_name, ctx.from?.last_name]
            .filter(Boolean)
            .join(' ') || null,
        draft: finalDraft,
      });
      sessions.set(ctx.chat!.id, { mode: 'idle' });
      await ctx.reply(`✅ Saved! Listing ID: <code>${listingId}</code>`, {
        parse_mode: 'HTML',
      });
    } catch {
      await ctx.reply('❌ Failed to save your listing.');
    }
  });

  /* edit -> back to step 1 */
  bot.action(ACTIONS.G_EDIT as any, async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch {}
    const s = sessions.get(ctx.chat!.id);
    if (!s || s.mode !== 'guided') return;
    s.step = Step.TYPE_AUD;
    await replaceCard(
      ctx,
      s,
      '🍀 <b>Create an Ad (Guided)</b>\nPick the <b>type</b> and <b>audience</b>.',
      guidedTypeAudienceKeyboard(s.draft),
    );
  });

  /* text handlers (location + details; budget becomes interactive) */
  bot.on('text', async (ctx, next) => {
    const s = sessions.get(ctx.chat.id);
    if (!s || s.mode !== 'guided') return next?.();

    const text = (ctx.message.text || '').trim();
    if (!text) return;

    if (s.step === Step.LOCATION) {
      s.draft.areaText = text;
      s.step = Step.BUDGET_FURN;
      s.bfStage = 'rent';
      return replaceCard(
        ctx,
        s,
        rentText(s.draft),
        guidedRentKeyboard(s.draft),
      );
    }

    if (s.step === Step.DETAILS) {
      s.draft.description = text;
      s.step = Step.CONFIRM;
      const summary = renderSummary(s.draft);
      return replaceCard(
        ctx,
        s,
        `📄 <b>Summary</b>\n<code>${summary}</code>`,
        guidedConfirmKeyboard(),
      );
    }
  });

  /* ===== Budget & Furnishing – RENT ===== */
  bot.action(
    new RegExp(`^${ACTIONS.G_RENT_PRESET_PREFIX}(\\d+)$`),
    async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch {}
      const s = sessions.get(ctx.chat!.id);
      if (
        !s ||
        s.mode !== 'guided' ||
        s.step !== Step.BUDGET_FURN ||
        s.bfStage !== 'rent'
      )
        return;
      s.draft.price = Number(ctx.match![1]);
      await editOrReply(ctx, s, rentText(s.draft), guidedRentKeyboard(s.draft));
    },
  );

  bot.action(
    new RegExp(`^${ACTIONS.G_RENT_ADJ_PREFIX}([+-]\\d+)$`),
    async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch {}
      const s = sessions.get(ctx.chat!.id);
      if (
        !s ||
        s.mode !== 'guided' ||
        s.step !== Step.BUDGET_FURN ||
        s.bfStage !== 'rent'
      )
        return;
      const delta = Number(ctx.match![1]);
      const base = s.draft.price || 0;
      s.draft.price = Math.max(0, base + delta);
      await editOrReply(ctx, s, rentText(s.draft), guidedRentKeyboard(s.draft));
    },
  );

  bot.action(ACTIONS.G_RENT_DONE as any, async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch {}
    const s = sessions.get(ctx.chat!.id);
    if (!s || s.mode !== 'guided' || s.step !== Step.BUDGET_FURN) return;
    s.bfStage = 'deposit';
    await replaceCard(
      ctx,
      s,
      depositText(s.draft),
      guidedDepositKeyboard(s.draft),
    );
  });

  /* ===== Budget & Furnishing – DEPOSIT ===== */
  bot.action(
    new RegExp(`^${ACTIONS.G_DEP_SET_PREFIX}(none|1x|2x|3x|same)$`),
    async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch {}
      const s = sessions.get(ctx.chat!.id);
      if (
        !s ||
        s.mode !== 'guided' ||
        s.step !== Step.BUDGET_FURN ||
        s.bfStage !== 'deposit'
      )
        return;
      const mode = ctx.match![1];
      if (mode === 'none') s.draft.deposit = null;
      else if (mode === 'same' || mode === '1x')
        s.draft.deposit = s.draft.price ?? null;
      else if (mode === '2x')
        s.draft.deposit = s.draft.price ? s.draft.price * 2 : null;
      else if (mode === '3x')
        s.draft.deposit = s.draft.price ? s.draft.price * 3 : null;
      await editOrReply(
        ctx,
        s,
        depositText(s.draft),
        guidedDepositKeyboard(s.draft),
      );
    },
  );

  bot.action(
    new RegExp(`^${ACTIONS.G_DEP_ADJ_PREFIX}([+-]\\d+)$`),
    async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch {}
      const s = sessions.get(ctx.chat!.id);
      if (
        !s ||
        s.mode !== 'guided' ||
        s.step !== Step.BUDGET_FURN ||
        s.bfStage !== 'deposit'
      )
        return;
      const delta = Number(ctx.match![1]);
      const base = s.draft.deposit ?? 0;
      s.draft.deposit = Math.max(0, base + delta);
      await editOrReply(
        ctx,
        s,
        depositText(s.draft),
        guidedDepositKeyboard(s.draft),
      );
    },
  );

  bot.action(ACTIONS.G_DEP_DONE as any, async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch {}
    const s = sessions.get(ctx.chat!.id);
    if (!s || s.mode !== 'guided' || s.step !== Step.BUDGET_FURN) return;
    s.bfStage = 'furn';
    if (!s.draft.furnished) s.draft.furnished = FurnishedType.UNFURNISHED;
    await replaceCard(
      ctx,
      s,
      furnText(s.draft),
      guidedFurnishingKeyboard(s.draft),
    );
  });

  /* ===== Budget & Furnishing – FURNISHING ===== */
  bot.action(
    new RegExp(`^${ACTIONS.G_FURN_SET_PREFIX}(unfurnished|semi|furnished)$`),
    async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch {}
      const s = sessions.get(ctx.chat!.id);
      if (
        !s ||
        s.mode !== 'guided' ||
        s.step !== Step.BUDGET_FURN ||
        s.bfStage !== 'furn'
      )
        return;
      s.draft.furnished = ctx.match![1] as any;
      await editOrReply(
        ctx,
        s,
        furnText(s.draft),
        guidedFurnishingKeyboard(s.draft),
      );
    },
  );

  /* back within Budget & Furnishing */
  bot.action(ACTIONS.G_BACK as any, async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch {}
    const s = sessions.get(ctx.chat!.id);
    if (!s || s.mode !== 'guided' || s.step !== Step.BUDGET_FURN) return;
    if (s.bfStage === 'deposit') {
      s.bfStage = 'rent';
      return replaceCard(
        ctx,
        s,
        rentText(s.draft),
        guidedRentKeyboard(s.draft),
      );
    }
    if (s.bfStage === 'furn') {
      s.bfStage = 'deposit';
      return replaceCard(
        ctx,
        s,
        depositText(s.draft),
        guidedDepositKeyboard(s.draft),
      );
    }
  });

  /* helpers */
  function fmtINR(n?: number | null) {
    if (typeof n !== 'number' || n < 0) return '—';
    return '₹' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  const rentText = (d: GuidedDraft) =>
    `💰 <b>Budget (Rent)</b>\nSelected: <b>${fmtINR(d.price)}</b>`;
  const depositText = (d: GuidedDraft) =>
    `💰 <b>Budget (Deposit)</b>\nSelected: <b>${fmtINR(d.deposit)}</b>`;
  const furnText = (d: GuidedDraft) =>
    `🛋️ <b>Furnishing</b>\nSelected: <b>${(d.furnished || FurnishedType.UNFURNISHED).toString()}</b>`;

  async function redrawTypeAudCard(
    ctx: any,
    s: Extract<Session, { mode: 'guided' }>,
  ) {
    const html = [
      '🍀 <b>Create an Ad (Guided)</b>',
      `Type: <b>${s.draft.unitType ?? '-'}</b>`,
      `Audience: <b>${s.draft.audience ?? '-'}</b>`,
    ].join('\n');
    await editOrReply(ctx, s, html, guidedTypeAudienceKeyboard(s.draft));
  }
  async function redrawRulesCard(
    ctx: any,
    s: Extract<Session, { mode: 'guided' }>,
  ) {
    await editOrReply(
      ctx,
      s,
      '⚙️ <b>Rules</b>\nToggle what applies, then Next.',
      guidedRulesKeyboard(s.draft),
    );
  }

  async function replaceCard(
    ctx: any,
    s: Extract<Session, { mode: 'guided' }>,
    html: string,
    kb?: any,
  ) {
    const botApi = runtime.getBot().telegram;
    if (s.controlMsgId) {
      try {
        await botApi.deleteMessage(ctx.chat!.id, s.controlMsgId);
      } catch {}
    }
    const sent = await ctx.replyWithHTML(html, kb);
    s.controlMsgId = (sent as any).message_id;
    sessions.set(ctx.chat!.id, s);
  }
  async function editOrReply(
    ctx: any,
    s: Extract<Session, { mode: 'guided' }>,
    html: string,
    kb: any,
  ) {
    const botApi = runtime.getBot().telegram;
    if (s.controlMsgId) {
      try {
        await botApi.editMessageText(
          ctx.chat!.id,
          s.controlMsgId,
          undefined,
          html,
          {
            parse_mode: 'HTML',
            reply_markup: (kb as any)?.reply_markup,
          },
        );
        return;
      } catch {}
    }
    const sent = await ctx.replyWithHTML(html, kb);
    s.controlMsgId = (sent as any).message_id;
    sessions.set(ctx.chat!.id, s);
  }

  function renderSummary(d: GuidedDraft): string {
    const obj = {
      unitType: d.unitType ?? null,
      audience: d.audience ?? null,
      areaText: d.areaText ?? null,
      price: d.price ?? null,
      deposit: d.deposit ?? null,
      furnished: d.furnished ?? FurnishedType.UNFURNISHED,
      rules: {
        restrictions: d.restrictions,
        couplesAllowed: d.couplesAllowed,
        bachelorsAllowed: d.bachelorsAllowed,
        petsAllowed: d.petsAllowed,
        parkingAvailable: d.parkingAvailable,
      },
      description: d.description ?? null,
    };
    return JSON.stringify(obj, null, 2).slice(0, 3500);
  }

  function finalizeDraftForSave(d: GuidedDraft): GuidedDraft {
    const out: GuidedDraft = { ...d };
    if (!out.title) {
      const parts = [
        out.unitType ? String(out.unitType).toUpperCase() : '',
        out.areaText ? `in ${out.areaText}` : '',
        out.audience ? `for ${out.audience}` : '',
        out.price ? `– ₹${out.price}` : '',
      ].filter(Boolean);
      out.title = parts.join(' ').slice(0, 120);
    }
    if (!out.furnished) out.furnished = FurnishedType.UNFURNISHED;
    return out;
  }
}
