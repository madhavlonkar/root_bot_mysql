// modules/credits/entities/credits-wallet.entity.ts
import { User } from 'src/modules/users/entities/user.entity';
import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'credits_wallet' })
export class CreditsWallet {
  @PrimaryColumn('char', { length: 36, name: 'user_id' })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user?: User;

  @Column({ type: 'int', name: 'balance', default: () => '0' })
  balance!: number;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at', nullable: true })
  updatedAt!: Date | null;
}
