// modules/payments/entities/payment.entity.ts
import { PaymentGateway, PaymentStatus } from 'src/common/enums/credits.enum';
import { User } from 'src/modules/users/entities/user.entity';
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

@Entity({ name: 'payments' })
@Index('idx_pay_user', ['userId'])
@Index('idx_pay_order', ['orderId'])
@Index('idx_pay_payment', ['paymentId'])
@Index('idx_pay_status', ['status'])
export class Payment {
  @PrimaryColumn('char', { length: 36, name: 'id' })
  id!: string;

  @Column('char', { length: 36, name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user?: User;

  @Column({
    type: 'enum',
    enum: PaymentGateway,
    name: 'gateway',
    default: PaymentGateway.RAZORPAY,
  })
  gateway!: PaymentGateway;

  @Column({ type: 'varchar', length: 100, name: 'order_id', nullable: true })
  orderId!: string | null;

  @Column({ type: 'varchar', length: 100, name: 'payment_id', nullable: true })
  paymentId!: string | null;

  @Column({ type: 'varchar', length: 200, name: 'signature', nullable: true })
  signature!: string | null;

  @Column({ type: 'int', name: 'amount' })
  amount!: number; // paise

  @Column({ type: 'varchar', length: 10, name: 'currency', default: 'INR' })
  currency!: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    name: 'status',
    default: PaymentStatus.CREATED,
  })
  status!: PaymentStatus;

  @Column({ type: 'json', name: 'payload', nullable: true })
  payload!: any;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at', nullable: true })
  updatedAt!: Date | null;
}
