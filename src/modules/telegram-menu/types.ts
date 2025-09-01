import { IntakeMediaInput } from 'src/modules/listing-intake/listing-intake.service';
import { Audience } from 'src/common/enums/audience.enum';
import { FurnishedType, UnitType } from 'src/common/enums/flats.enum';

export enum Step {
  TYPE_AUD = 1,
  LOCATION = 2,
  BUDGET_FURN = 3,
  RULES = 4,
  DETAILS = 5,
  CONFIRM = 6,
}

export type GuidedDraft = {
  // enums
  unitType?: UnitType | null;
  audience?: Audience | null;

  // location
  areaText?: string | null;
  cityId?: string | null;
  areaId?: string | null;
  addressLine?: string | null;

  // money + furnishing
  price?: number;
  deposit?: number | null;
  furnished?: FurnishedType;

  // rules
  restrictions: boolean;
  couplesAllowed: boolean;
  bachelorsAllowed: boolean;
  petsAllowed: boolean;
  parkingAvailable: boolean;

  // details
  description?: string | null;
  contactDetails?: string | null;

  // misc
  amenities?: any | null;
  nearbyPlaces?: any | null;
  tags?: string[] | null;

  title?: string | null;
};

export type Session =
  | { mode: 'idle' }
  | { mode: 'awaiting_text_quick' }
  | {
      mode: 'awaiting_images';
      listingId: string;
      uploadedCount: number;
      controlMsgId?: number;
      pending: IntakeMediaInput[];
    }
  | {
      mode: 'guided';
      step: Step;
      draft: GuidedDraft;
      controlMsgId?: number;
      /** sub-stage inside Step.BUDGET_FURN */
      bfStage?: 'rent' | 'deposit' | 'furn';
    };

export type AwaitingGroupBucket = {
  chatId: number;
  listingId: string;
  items: IntakeMediaInput[];
  timer?: NodeJS.Timeout;
};

export type QuickAlbumBucket = {
  chatId: number;
  fromUserId: number;
  fromUsername?: string | null;
  fromDisplayName?: string | null;
  items: IntakeMediaInput[];
  caption?: string | null;
  timer?: NodeJS.Timeout;
};
