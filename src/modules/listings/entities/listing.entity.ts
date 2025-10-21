// modules/listings/entities/listing.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Audience } from '../../../common/enums/audience.enum';
import { ListingStatus } from '../../../common/enums/listing-status.enum';
import { User } from 'src/modules/users/entities/user.entity';
import { FurnishedType, UnitType } from 'src/common/enums/flats.enum';
import { City } from 'src/modules/master/entities/city.entity';
import { Area } from 'src/modules/master/entities/area.entity';

@Entity({ name: 'listings' })
@Index('idx_owner', ['ownerUserId'])
@Index('idx_status', ['status'])
@Index('idx_city', ['cityId'])
@Index('idx_area', ['areaId'])
@Index('idx_price', ['price'])
@Index('idx_type', ['unitType'])
@Index('idx_audience', ['audience'])
@Index('idx_listings_browse_1', ['status', 'cityId', 'price'])
@Index('idx_listings_browse_2', ['status', 'unitType', 'price'])
@Index('idx_listings_browse_3', ['status', 'audience', 'createdAt'])
export class Listing {
  @PrimaryColumn('char', { length: 36, name: 'id' })
  id!: string;

  @Column('char', { length: 36, name: 'owner_user_id' })
  ownerUserId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_user_id', referencedColumnName: 'id' })
  owner?: User;

  @Column({ type: 'enum', enum: Audience, name: 'audience' })
  audience!: Audience | null;

  @Column({ type: 'enum', enum: UnitType, name: 'unit_type' })
  unitType!: UnitType | null;

  @Column({ type: 'varchar', length: 120, name: 'title', nullable: true })
  title!: string | null;

  @Column({ type: 'text', name: 'description', nullable: true })
  description!: string | null;

  @Column('char', { length: 36, name: 'city_id', nullable: true })
  cityId!: string | null;

  @ManyToOne(() => City, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'city_id', referencedColumnName: 'id' })
  city?: City | null;

  @Column('char', { length: 36, name: 'area_id', nullable: true })
  areaId!: string | null;

  @ManyToOne(() => Area, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'area_id', referencedColumnName: 'id' })
  area?: Area | null;

  @Column({ type: 'varchar', length: 120, name: 'area_text', nullable: true })
  areaText!: string | null;

  @Column({ type: 'text', name: 'address_line', nullable: true })
  addressLine!: string | null;

  @Column({ type: 'int', name: 'price' })
  price!: number;

  @Column({ type: 'int', name: 'deposit', nullable: true })
  deposit!: number | null;

  @Column({
    type: 'enum',
    enum: FurnishedType,
    name: 'furnished',
    default: FurnishedType.UNFURNISHED,
  })
  furnished!: FurnishedType;

  // Rules
  @Column({ type: 'boolean', name: 'restrictions', default: true })
  restrictions!: boolean;

  @Column({ type: 'boolean', name: 'couples_allowed', default: false })
  couplesAllowed!: boolean;

  @Column({ type: 'boolean', name: 'bachelors_allowed', default: true })
  bachelorsAllowed!: boolean;

  @Column({ type: 'boolean', name: 'pets_allowed', default: true })
  petsAllowed!: boolean;

  @Column({ type: 'boolean', name: 'parking_available', default: true })
  parkingAvailable!: boolean;

  // Contact
  @Column({ type: 'text', name: 'contact_details', nullable: true })
  contactDetails!: string | null;

  // Structured extras
  @Column({ type: 'json', name: 'amenities', nullable: true })
  amenities!: string[] | null; // ["lift","security","gym"]

  @Column({ type: 'json', name: 'nearby_places', nullable: true })
  nearbyPlaces!: string[] | null; // ["school","hospital","mall"]

  @Column({ type: 'json', name: 'tags', nullable: true })
  tags!: string[] | null;

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes!: string | null;

  // Lifecycle
  @Column({
    type: 'enum',
    enum: ListingStatus,
    name: 'status',
    default: ListingStatus.DRAFT,
  })
  status!: ListingStatus;

  @Column({ type: 'datetime', name: 'published_at', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'datetime', name: 'posted_at', nullable: true })
  postedAt!: Date | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at', nullable: true })
  updatedAt!: Date | null;

  // Metrics
  @Column({ type: 'int', name: 'views_count', default: () => '0' })
  viewsCount!: number;
}
