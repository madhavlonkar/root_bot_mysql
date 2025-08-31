// modules/wishlist/entities/wishlist.entity.ts
import { Listing } from 'src/modules/listings/entities/listing.entity';
import { User } from 'src/modules/users/entities/user.entity';
import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

@Entity({ name: 'wishlist' })
export class Wishlist {
  @PrimaryColumn('char', { length: 36, name: 'user_id' })
  userId!: string;

  @PrimaryColumn('char', { length: 36, name: 'listing_id' })
  listingId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user?: User;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id', referencedColumnName: 'id' })
  listing?: Listing;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;
}
