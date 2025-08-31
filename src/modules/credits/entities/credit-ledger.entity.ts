// modules/credits/entities/credits-ledger.entity.ts
import { LedgerAction } from 'src/common/enums/credits.enum';
import { Listing } from 'src/modules/listings/entities/listing.entity';
import { User } from 'src/modules/users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

@Entity({ name: 'credits_ledger' })
@Index('idx_ledger_user', ['userId'])
@Index('idx_ledger_listing', ['listingId'])
@Index('idx_ledger_action', ['action'])
export class CreditsLedger {
  @PrimaryColumn('char', { length: 36, name: 'id' })
  id!: string;

  @Column('char', { length: 36, name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user?: User;

  @Column({ type: 'enum', enum: LedgerAction, name: 'action' })
  action!: LedgerAction;

  @Column({ type: 'int', name: 'amount' })
  amount!: number; // + add, - spend

  @Column('char', { length: 36, name: 'listing_id', nullable: true })
  listingId!: string | null;

  @ManyToOne(() => Listing, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'listing_id', referencedColumnName: 'id' })
  listing?: Listing | null;

  @Column('char', { length: 36, name: 'payment_id', nullable: true })
  paymentId!: string | null;

  @Column({ type: 'json', name: 'metadata', nullable: true })
  metadata!: any;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;
}
