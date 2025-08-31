import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ListingIntakeModule } from './modules/listing-intake/listing-intake.module';
import { TelegramBotModule } from './modules/telegram/telegram-bot.module';
import { TelegramMenuModule } from './modules/telegram-menu/telegram-menu.module';
import { User } from './modules/users/entities/user.entity';
import { ListingMedia } from './modules/listings/entities/listing-media.entity';
import { Listing } from './modules/listings/entities/listing.entity';
import { City } from './modules/master/entities/city.entity';
import { Area } from './modules/master/entities/area.entity';

@Module({
  imports: [
    // Load .env globally
    ConfigModule.forRoot({ isGlobal: true }),

    // TypeORM MySQL (sync ON for dev)
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST', '127.0.0.1'),
        port: Number(config.get<string>('DB_PORT', '3306')),
        username: config.get<string>('DB_USER', 'root'),
        password: config.get<string>('DB_PASS', ''),
        database: config.get<string>('DB_NAME', 'room_bot'),

        // IMPORTANT: auto-loads all @Entity classes from any imported module
        entities: [Listing, ListingMedia, User, City, Area],
        // You asked to keep it true; we’ll rely on env flag but default to true.
        synchronize: config.get<string>('TYPEORM_SYNC', 'true') === 'true',

        // Recommended for emoji/UTF-8 content
        charset: 'utf8mb4',
      }),
    }),
    ListingIntakeModule,
    TelegramBotModule,
    TelegramMenuModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
