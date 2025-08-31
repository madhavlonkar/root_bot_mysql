// modules/listings/entities/listing-media.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Listing } from './listing.entity';
import { MediaKind } from 'src/common/enums/flats.enum';

@Entity({ name: 'listing_media' })
@Index('idx_listing', ['listingId'])
export class ListingMedia {
  @PrimaryColumn('char', { length: 36, name: 'id' })
  id!: string;

  @Column('char', { length: 36, name: 'listing_id' })
  listingId!: string;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id', referencedColumnName: 'id' })
  listing?: Listing;

  @Column({ type: 'enum', enum: MediaKind, name: 'kind' })
  kind!: MediaKind;

  @Column({ type: 'varchar', length: 255, name: 'tg_file_id' })
  tgFileId!: string;

  @Column({ type: 'varchar', length: 255, name: 'tg_file_unique_id' })
  tgFileUniqueId!: string;

  @Column({ type: 'int', name: 'width', nullable: true })
  width!: number | null;

  @Column({ type: 'int', name: 'height', nullable: true })
  height!: number | null;

  @Column({ type: 'varchar', length: 255, name: 'file_name', nullable: true })
  fileName!: string | null;

  @Column({ type: 'varchar', length: 100, name: 'mime_type', nullable: true })
  mimeType!: string | null;

  @Column({ type: 'int', name: 'file_size', nullable: true })
  fileSize!: number | null;

  @Column({ type: 'varchar', length: 500, name: 'cdn_url', nullable: true })
  cdnUrl!: string | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;
}
