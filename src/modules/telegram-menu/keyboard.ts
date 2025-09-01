import { Markup } from 'telegraf';
import { ACTIONS } from './constants';
import { GuidedDraft } from './types';
import { FurnishedType } from 'src/common/enums/flats.enum';

export function postChooserKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Paste/Forward Ad ⚡', ACTIONS.CHOOSE_QUICK),
      Markup.button.callback(
        'Guided: Answer Questions 🧠',
        ACTIONS.CHOOSE_GUIDED,
      ),
    ],
  ]);
}

export function imagesControlKeyboard(listingId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('I’m done ✅', ACTIONS.IMGDONE_PREFIX + listingId)],
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

/** Step 1: pick UnitType + Audience */
export function guidedTypeAudienceKeyboard(draft: GuidedDraft) {
  const unitRow1 = ['1rk', '1bhk', '2bhk', '3bhk'].map((v) =>
    Markup.button.callback(
      (String(draft.unitType) === String(v) ? '• ' : '') + v.toUpperCase(),
      ACTIONS.G_UNIT_PREFIX + v,
    ),
  );
  const unitRow2 = ['single_room', 'flatmates', 'pg', 'hostel'].map((v) =>
    Markup.button.callback(
      (String(draft.unitType) === String(v) ? '• ' : '') + v.replace('_', ' '),
      ACTIONS.G_UNIT_PREFIX + v,
    ),
  );
  const audRow = ['boys', 'girls', 'couples', 'family', 'anyone'].map((v) =>
    Markup.button.callback(
      (String(draft.audience) === String(v) ? '• ' : '') +
        v[0].toUpperCase() +
        v.slice(1),
      ACTIONS.G_AUD_PREFIX + v,
    ),
  );

  const rows: any[] = [unitRow1, unitRow2, audRow];
  if (draft.unitType && draft.audience)
    rows.push([Markup.button.callback('Next ▶️', ACTIONS.G_NEXT)]);
  rows.push([Markup.button.callback('Cancel ❌', ACTIONS.G_CANCEL)]);
  return Markup.inlineKeyboard(rows);
}

/** Step 4: rules toggles + Next */
export function guidedRulesKeyboard(d: GuidedDraft) {
  const btn = (label: string, key: string, on?: boolean) =>
    Markup.button.callback(
      `${on ? '✅' : '⬜️'} ${label}`,
      ACTIONS.G_RULE_PREFIX + key,
    );

  const rows = [
    [
      btn('Couples', 'couples', d.couplesAllowed),
      btn('Bachelors', 'bachelors', d.bachelorsAllowed),
      btn('Pets', 'pets', d.petsAllowed),
    ],
    [
      btn('Parking', 'parking', d.parkingAvailable),
      btn('Restrictions', 'restrictions', d.restrictions),
    ],
    [Markup.button.callback('Next ▶️', ACTIONS.G_NEXT)],
    [Markup.button.callback('Cancel ❌', ACTIONS.G_CANCEL)],
  ];
  return Markup.inlineKeyboard(rows);
}

/** Step 6: final confirm */
export function guidedConfirmKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Save ✅', ACTIONS.G_SAVE)],
    [
      Markup.button.callback('Edit ↩️', ACTIONS.G_EDIT),
      Markup.button.callback('Cancel ❌', ACTIONS.G_CANCEL),
    ],
  ]);
}

/* ---------- Interactive Budget & Furnishing ---------- */

export function guidedRentKeyboard(d: GuidedDraft) {
  const presets = [8000, 10000, 12000, 15000, 18000, 20000, 25000, 30000];
  const row = (arr: number[]) =>
    arr.map((v) =>
      Markup.button.callback(
        (d.price === v ? '• ' : '') + `${v / 1000}k`,
        ACTIONS.G_RENT_PRESET_PREFIX + v,
      ),
    );

  return Markup.inlineKeyboard([
    row(presets.slice(0, 4)),
    row(presets.slice(4, 8)),
    [
      Markup.button.callback('−5k', ACTIONS.G_RENT_ADJ_PREFIX + '-5000'),
      Markup.button.callback('−1k', ACTIONS.G_RENT_ADJ_PREFIX + '-1000'),
      Markup.button.callback('+1k', ACTIONS.G_RENT_ADJ_PREFIX + '+1000'),
      Markup.button.callback('+5k', ACTIONS.G_RENT_ADJ_PREFIX + '+5000'),
    ],
    [
      Markup.button.callback('Done ▶️', ACTIONS.G_RENT_DONE),
      Markup.button.callback('Cancel ❌', ACTIONS.G_CANCEL),
    ],
  ]);
}

export function guidedDepositKeyboard(d: GuidedDraft) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        (d.deposit == null ? '• ' : '') + 'No deposit',
        ACTIONS.G_DEP_SET_PREFIX + 'none',
      ),
      Markup.button.callback('1×', ACTIONS.G_DEP_SET_PREFIX + '1x'),
      Markup.button.callback('2×', ACTIONS.G_DEP_SET_PREFIX + '2x'),
      Markup.button.callback('3×', ACTIONS.G_DEP_SET_PREFIX + '3x'),
    ],
    [Markup.button.callback('Same as rent', ACTIONS.G_DEP_SET_PREFIX + 'same')],
    [
      Markup.button.callback('−5k', ACTIONS.G_DEP_ADJ_PREFIX + '-5000'),
      Markup.button.callback('−1k', ACTIONS.G_DEP_ADJ_PREFIX + '-1000'),
      Markup.button.callback('+1k', ACTIONS.G_DEP_ADJ_PREFIX + '+1000'),
      Markup.button.callback('+5k', ACTIONS.G_DEP_ADJ_PREFIX + '+5000'),
    ],
    [
      Markup.button.callback('Back ◀️', ACTIONS.G_BACK),
      Markup.button.callback('Done ▶️', ACTIONS.G_DEP_DONE),
      Markup.button.callback('Cancel ❌', ACTIONS.G_CANCEL),
    ],
  ]);
}

export function guidedFurnishingKeyboard(d: GuidedDraft) {
  const btn = (val: FurnishedType, label: string) =>
    Markup.button.callback(
      `${d.furnished === val ? '• ' : ''}${label}`,
      ACTIONS.G_FURN_SET_PREFIX + val,
    );
  return Markup.inlineKeyboard([
    [
      btn(FurnishedType.UNFURNISHED, 'Unfurnished'),
      btn(FurnishedType.SEMI, 'Semi'),
      btn(FurnishedType.FURNISHED, 'Furnished'),
    ],
    [
      Markup.button.callback('Back ◀️', ACTIONS.G_BACK),
      Markup.button.callback('Next ▶️', ACTIONS.G_NEXT),
      Markup.button.callback('Cancel ❌', ACTIONS.G_CANCEL),
    ],
  ]);
}
