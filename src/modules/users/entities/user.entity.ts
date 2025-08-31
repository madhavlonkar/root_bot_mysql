// modules/users/entities/user.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'users' })
@Index('uk_tg_user', ['tgUserId'], { unique: true })
export class User {
  @PrimaryColumn('char', { length: 36, name: 'id' })
  id!: string;

  @Column({ type: 'bigint', name: 'tg_user_id' })
  tgUserId!: string; // store BIGINT as string in TS

  @Column({ type: 'varchar', length: 64, name: 'tg_username', nullable: true })
  tgUsername!: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'display_name',
    nullable: true,
  })
  displayName!: string | null;

  @Column({ type: 'varchar', length: 20, name: 'phone_e164', nullable: true })
  phoneE164!: string | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at', nullable: true })
  updatedAt!: Date | null;
}
