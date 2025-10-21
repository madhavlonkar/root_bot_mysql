// modules/listings/listing.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { Listing } from './entities/listing.entity';
import { ListingStatus } from 'src/common/enums/listing-status.enum';

@Injectable()
export class ListingService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingRepo: Repository<Listing>,
  ) {}

  /**
   * Newest public listings by postedAt desc, with a hard cap.
   * Returns slice + totals for nicer pagination UI.
   */
  async listLatestPublicByPostedAt(
    skip = 0,
    take = 5,
    cap = 10,
  ): Promise<{
    items: Listing[];
    total: number; // <= cap
    page: number; // 0-based
    pages: number; // total pages
    hasPrev: boolean;
    hasNext: boolean;
    from: number; // 1-based index of first item in this page within the capped window
    to: number; // 1-based index of last item in this page within the capped window
  }> {
    const where = {
      status: ListingStatus.PUBLISHED, // adjust if your live status differs
      postedAt: Not(IsNull()),
    } as const;

    const rawCount = await this.listingRepo.count({ where });
    const total = Math.min(rawCount, cap);
    if (total === 0) {
      return {
        items: [],
        total: 0,
        page: 0,
        pages: 0,
        hasPrev: false,
        hasNext: false,
        from: 0,
        to: 0,
      };
    }

    const boundedSkip = Math.min(skip, Math.max(0, total - 1));
    const available = Math.max(0, total - boundedSkip);
    const pageSize = Math.min(take + 1, available); // +1 to peek next

    const rows = await this.listingRepo.find({
      where,
      order: { postedAt: 'DESC' },
      skip: boundedSkip,
      take: pageSize,
    });

    const items = rows.slice(0, Math.min(take, rows.length));
    const hasNext = rows.length > take && boundedSkip + take < total;
    const pages = Math.max(1, Math.ceil(total / take));
    const page = Math.floor(boundedSkip / take);
    const hasPrev = page > 0;

    const from = boundedSkip + 1;
    const to = boundedSkip + items.length;

    return { items, total, page, pages, hasPrev, hasNext, from, to };
  }
}
