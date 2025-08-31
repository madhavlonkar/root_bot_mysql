// modules/master/entities/area.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { City } from './city.entity';

@Entity({ name: 'areas' })
@Index('idx_area_city', ['cityId'])
@Index('idx_area_name', ['name'])
export class Area {
  @PrimaryColumn('char', { length: 36, name: 'id' })
  id!: string;

  @Column('char', { length: 36, name: 'city_id' })
  cityId!: string;

  @ManyToOne(() => City, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'city_id', referencedColumnName: 'id' })
  city?: City;

  @Column({ type: 'varchar', length: 120, name: 'name' })
  name!: string;

  @Column({ type: 'json', name: 'alt_names', nullable: true })
  altNames!: string[] | null;

  @Column({ type: 'tinyint', name: 'is_active', default: () => '1' })
  isActive!: boolean;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;
}
