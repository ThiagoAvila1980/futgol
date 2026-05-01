import { Module } from '@nestjs/common';
import {
  AchievementsRestController,
  AiRestController,
  CatalogRestController,
  FieldsRestController,
  GroupsRestController,
  MarketplaceRestController,
  MatchesRestController,
  OwnerFieldsRestController,
  OwnerVenuesRestController,
  PlayersRestController,
  PushRestController,
  RankingRestController,
  TransactionsRestController,
  WhatsappRestController,
} from './rest.controllers';

@Module({
  controllers: [
    GroupsRestController,
    CatalogRestController,
    PlayersRestController,
    FieldsRestController,
    MatchesRestController,
    RankingRestController,
    TransactionsRestController,
    OwnerFieldsRestController,
    OwnerVenuesRestController,
    PushRestController,
    AiRestController,
    AchievementsRestController,
    WhatsappRestController,
    MarketplaceRestController,
  ],
})
export class RestModule {}
