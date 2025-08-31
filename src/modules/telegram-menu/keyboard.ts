import { Markup } from 'telegraf';
import { ACTIONS } from './constants';

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
