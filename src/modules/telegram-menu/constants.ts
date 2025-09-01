export const MENU = {
  BROWSE: 'Browse 🏠',
  POST: 'Post Ad ➕',
  BOOSTED: 'Boosted 🔝',
  WISHLIST: 'Wishlist ⭐',
  MY_ADS: 'My Ads 📂',
  CREDITS: 'Credits 💳',
  SUPPORT: 'Support 🛟',
} as const;

export const ACTIONS = {
  CHOOSE_QUICK: 'post:quick',
  CHOOSE_GUIDED: 'post:guided',

  ADDPICS_PREFIX: 'addpics:',
  SKIP_PREFIX: 'skip:',
  IMGDONE_PREFIX: 'images:done:',
  IMGDISCARD_PREFIX: 'images:discard:',
  IMGMORE_PREFIX: 'images:more:',

  // Guided: type & audience
  G_UNIT_PREFIX: 'g:unit:',
  G_AUD_PREFIX: 'g:aud:',
  G_NEXT: 'g:next',
  G_CANCEL: 'g:cancel',
  G_EDIT: 'g:edit',
  G_SAVE: 'g:save',
  G_RULE_PREFIX: 'g:rule:',

  // Guided: Budget & Furnishing (interactive)
  G_RENT_PRESET_PREFIX: 'g:rent:set:', // e.g. g:rent:set:18000
  G_RENT_ADJ_PREFIX: 'g:rent:adj:', // e.g. g:rent:adj:+1000 / -5000
  G_RENT_DONE: 'g:rent:done',

  G_DEP_SET_PREFIX: 'g:dep:set:', // none | 1x | 2x | 3x | same
  G_DEP_ADJ_PREFIX: 'g:dep:adj:', // +1000 / -1000 / +5000 / -5000
  G_DEP_DONE: 'g:dep:done',

  G_FURN_SET_PREFIX: 'g:furn:set:', // unfurnished | semi | furnished
  G_BACK: 'g:back',
} as const;
