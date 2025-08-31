// modules/boosts/entities/listing-boost.entity.ts
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
import { Listing } from '../../listings/entities/listing.entity';
import { User } from '../../users/entities/user.entity';
import { BoostStatus } from 'src/common/enums/flats.enum';

@Entity({ name: 'listing_boosts' })
@Index('idx_boost_listing', ['listingId'])
@Index('idx_boost_user', ['userId'])
@Index('idx_boost_status', ['status'])
@Index('idx_boost_expiry', ['boostAvailableTill'])
export class ListingBoost {
  @PrimaryColumn('char', { length: 36, name: 'id' })
  id!: string;

  @Column('char', { length: 36, name: 'listing_id' })
  listingId!: string;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id', referencedColumnName: 'id' })
  listing?: Listing;

  @Column('char', { length: 36, name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user?: User;

  @Column({ type: 'int', name: 'credits_spent' })
  creditsSpent!: number;

  @Column({
    type: 'enum',
    enum: BoostStatus,
    name: 'status',
    default: BoostStatus.ACTIVE,
  })
  status!: BoostStatus;

  @Column({ type: 'datetime', name: 'boost_available_till' })
  boostAvailableTill!: Date;

  @Column({ type: 'datetime', name: 'paid_at' })
  paidAt!: Date;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at', nullable: true })
  updatedAt!: Date | null;
}
