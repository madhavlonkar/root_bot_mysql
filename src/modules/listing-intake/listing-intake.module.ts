import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from 'src/modules/listings/entities/listing.entity';
import { ListingMedia } from 'src/modules/listings/entities/listing-media.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { ListingIntakeService } from './listing-intake.service';

@Module({
  imports: [TypeOrmModule.forFeature([Listing, ListingMedia, User])],
  providers: [ListingIntakeService],
  exports: [ListingIntakeService],
})
export class ListingIntakeModule {}
