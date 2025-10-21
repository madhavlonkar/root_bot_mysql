import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from './entities/listing.entity';
import { ListingService } from './listing.service';

// listings.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([Listing])],
  providers: [ListingService],
  exports: [ListingService],
})
export class ListingsModule {}
