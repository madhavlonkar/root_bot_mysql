import { IntakeMediaInput } from 'src/modules/listing-intake/listing-intake.service';

export type Session =
  | { mode: 'idle' }
  | { mode: 'awaiting_text_quick' }
  | {
      mode: 'awaiting_images';
      listingId: string;
      uploadedCount: number;
      controlMsgId?: number;
      pending: IntakeMediaInput[];
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
