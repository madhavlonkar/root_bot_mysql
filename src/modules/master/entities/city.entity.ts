// modules/master/entities/city.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity({ name: 'cities' })
@Index('idx_city_name', ['name'])
@Index('idx_city_active', ['isActive'])
export class City {
  @PrimaryColumn('char', { length: 36, name: 'id' })
  id!: string;

  @Column({ type: 'varchar', length: 80, name: 'name' })
  name!: string;

  @Column({ type: 'varchar', length: 80, name: 'state', nullable: true })
  state!: string | null;

  @Column({ type: 'varchar', length: 80, name: 'country', default: 'India' })
  country!: string;

  @Column({ type: 'tinyint', name: 'is_active', default: () => '1' })
  isActive!: boolean;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;
}
