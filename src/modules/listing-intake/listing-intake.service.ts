// src/modules/listing-intake/listing-intake.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Listing } from 'src/modules/listings/entities/listing.entity';
import { ListingMedia } from 'src/modules/listings/entities/listing-media.entity';
import { Audience } from 'src/common/enums/audience.enum';
import {
  FurnishedType,
  MediaKind,
  UnitType,
} from 'src/common/enums/flats.enum';
import { ListingStatus } from 'src/common/enums/listing-status.enum';
import { User } from 'src/modules/users/entities/user.entity';

export type IntakeMediaInput = {
  kind: 'photo' | 'document';
  tgFileId: string;
  tgFileUniqueId: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
  tgMessageId: number;
  caption?: string | null;
};

@Injectable()
export class ListingIntakeService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingRepo: Repository<Listing>,
    @InjectRepository(ListingMedia)
    private readonly mediaRepo: Repository<ListingMedia>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Create a DRAFT listing from a text message.
   * Duplicate checks:
   *  - same Telegram message id tag (tg:msg=...) already present -> DUPLICATE_POST
   *  - same title for the owner -> DUPLICATE_TITLE
   */
  async createDraftListingFromText(opts: {
    chatId: number;
    fromUserId: number;
    fromUsername?: string | null;
    fromDisplayName?: string | null;
    tgMessageId: number;
    text: string;
  }): Promise<string> {
    const {
      chatId,
      fromUserId,
      fromUsername,
      fromDisplayName,
      tgMessageId,
      text,
    } = opts;

    // 1) duplicate by telegram message id tag
    if (await this.isDuplicateByMessageTag(tgMessageId)) {
      const err = new Error('DUPLICATE_POST');
      (err as any).reason = 'message';
      throw err;
    }

    // 2) ensure owner
    const owner = await this.findOrCreateUserByTelegram(
      fromUserId,
      fromUsername ?? null,
      fromDisplayName ?? null,
    );

    // 3) parse defaults
    const title = (text ?? '').slice(0, 120) || 'Untitled';
    const description = text ?? null;
    const price = this.extractPrice(text);
    const audience = this.safeEnumPick(Audience);
    const unitType = this.safeEnumPick(UnitType);
    const furnished = FurnishedType.UNFURNISHED;

    // 4) duplicate by title for this owner
    if (await this.isDuplicateTitleForOwner(owner.id, title)) {
      const err = new Error('DUPLICATE_TITLE');
      (err as any).reason = 'title';
      throw err;
    }

    // 5) create draft
    const listing: Listing = {
      id: uuid(),
      ownerUserId: owner.id,
      owner: undefined,

      audience,
      unitType,

      title,
      description,

      cityId: null,
      city: undefined,
      areaId: null,
      area: undefined,
      areaText: null,
      addressLine: null,

      price,
      deposit: null,

      furnished,

      restrictions: true,
      couplesAllowed: false,
      bachelorsAllowed: true,
      petsAllowed: true,
      parkingAvailable: true,

      contactDetails: null,

      amenities: null,
      nearbyPlaces: null,
      tags: [
        `tg:chat=${chatId}`,
        `tg:from=${fromUserId}`,
        `tg:msg=${tgMessageId}`,
        ...(fromUsername ? [`tg:username=@${fromUsername}`] : []),
      ],
      notes: null,

      status: ListingStatus.DRAFT,
      publishedAt: null,
      postedAt: null,

      createdAt: undefined as any,
      updatedAt: undefined as any,

      viewsCount: 0,
    };

    await this.listingRepo.save(listing);
    return listing.id;
  }

  async saveListingMedia(
    listingId: string,
    m: IntakeMediaInput,
  ): Promise<void> {
    const kind = m.kind === 'photo' ? MediaKind.PHOTO : MediaKind.DOCUMENT;
    const row: ListingMedia = {
      id: uuid(),
      listingId,
      listing: undefined,
      kind,
      tgFileId: m.tgFileId,
      tgFileUniqueId: m.tgFileUniqueId,
      width: m.width ?? null,
      height: m.height ?? null,
      fileName: m.fileName ?? null,
      mimeType: m.mimeType ?? null,
      fileSize: m.fileSize ?? null,
      cdnUrl: null,
      createdAt: undefined as any,
    };
    await this.mediaRepo.save(row); // allow duplicates across (and within) listings
  }

  async anyMediaAlreadyExists(uniqueIds: string[]): Promise<boolean> {
    if (!uniqueIds.length) return false;
    const cnt = await this.mediaRepo
      .createQueryBuilder('m')
      .where('m.tgFileUniqueId IN (:...ids)', { ids: uniqueIds })
      .getCount();
    return cnt > 0;
  }

  async isDuplicateByMessageTag(tgMessageId: number): Promise<boolean> {
    const tag = `tg:msg=${tgMessageId}`;
    // MySQL JSON_SEARCH(tags, 'one', 'tg:msg=123') IS NOT NULL
    const qb = this.listingRepo
      .createQueryBuilder('l')
      .where(`JSON_SEARCH(l.tags, 'one', :needle) IS NOT NULL`, {
        needle: tag,
      });
    const cnt = await qb.getCount();
    return cnt > 0;
  }

  async isDuplicateTitleForOwner(
    ownerUserId: string,
    title: string,
  ): Promise<boolean> {
    const cnt = await this.listingRepo.count({
      where: { ownerUserId, title },
      take: 1,
    });
    return cnt > 0;
  }

  async getListingWithMedia(listingId: string) {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId },
    });
    const media = await this.mediaRepo.find({
      where: { listingId },
      order: { createdAt: 'ASC' },
    });
    return { listing, media };
  }

  async listRecentDraftsForTelegramUser(tgUserId: number, take = 5) {
    const owner = await this.userRepo.findOne({
      where: { tgUserId: String(tgUserId) },
    });
    if (!owner) return [];
    return this.listingRepo.find({
      where: { ownerUserId: owner.id },
      order: { createdAt: 'DESC' },
      take,
    });
  }

  buildListingCaption(l: Listing): string {
    const esc = (s: string) =>
      (s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const title = l.title ? esc(l.title) : '(no title)';
    const status = esc(l.status);
    const created =
      l.createdAt?.toISOString().replace('T', ' ').slice(0, 19) ?? '';
    const body = esc(l.description ?? '');
    const tagLine =
      Array.isArray(l.tags) && l.tags.length
        ? `<b>Tags:</b> ${l.tags.map(esc).join(', ')}\n`
        : '';

    return (
      `<b>Title:</b> ${title}\n` +
      `<b>Status:</b> ${status}\n` +
      `<b>Created:</b> ${created}\n` +
      `<b>Listing ID:</b> <code>${l.id}</code>\n` +
      `<b>Owner:</b> <code>${l.ownerUserId}</code>\n` +
      `<b>Price:</b> ₹${l.price}\n` +
      tagLine +
      `\n<b>Body:</b>\n${body}`
    );
  }

  // ---------- helpers ----------

  private async findOrCreateUserByTelegram(
    tgUserIdNum: number,
    tgUsername: string | null,
    displayName: string | null,
  ): Promise<User> {
    const tgUserId = String(tgUserIdNum);
    let user = await this.userRepo.findOne({ where: { tgUserId } });

    if (user) {
      let dirty = false;
      if (tgUsername !== undefined && user.tgUsername !== tgUsername) {
        user.tgUsername = tgUsername;
        dirty = true;
      }
      if (displayName !== undefined && user.displayName !== displayName) {
        user.displayName = displayName;
        dirty = true;
      }
      if (dirty) await this.userRepo.save(user);
      return user;
    }

    const toInsert: User = {
      id: uuid(),
      tgUserId,
      tgUsername: tgUsername ?? null,
      displayName: displayName ?? null,
      phoneE164: null,
      createdAt: undefined as any,
      updatedAt: undefined as any,
    };
    try {
      await this.userRepo.insert(toInsert);
      return toInsert;
    } catch {
      user = await this.userRepo.findOne({ where: { tgUserId } });
      if (user) return user;
      throw new Error('Failed to create or fetch user for Telegram id');
    }
  }

  private safeEnumPick<T extends object>(e: T): any {
    const vals = Object.values(e as any);
    return vals[0];
  }

  private extractPrice(text: string): number {
    if (!text) return 0;
    const cleaned = text.replace(/,/g, '');
    const m = cleaned.match(/(?:₹|Rs\.?\s*)?(\d{2,9})/i);
    const n = m ? Number(m[1]) : 0;
    return Number.isFinite(n) ? n : 0;
  }
}
