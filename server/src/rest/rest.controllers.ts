import {
  All,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import groupsIndex from '../../api/groups';
import groupsByUser from '../../api/groups/by_user';
import groupsId from '../../api/groups/[id]';
import teamsIndex from '../../api/teams';
import positionsIndex from '../../api/positions';
import playersIndex from '../../api/players';
import playersId from '../../api/players/[id]';
import playersUpdateByUser from '../../api/players/update_by_user';
import fieldsIndex from '../../api/fields';
import fieldsId from '../../api/fields/[id]';
import matchesIndex from '../../api/matches';
import matchesId from '../../api/matches/[id]';
import matchesReopen from '../../api/matches/[id]/reopen';
import matchesCancel from '../../api/matches/[id]/cancel';
import matchesVote from '../../api/matches/[id]/vote';
import matchesVotes from '../../api/matches/[id]/votes';
import groupsMembers from '../../api/groups/[id]/members';
import transactionsIndex from '../../api/transactions';
import transactionsId from '../../api/transactions/[id]';
import transactionsUpsertMatch from '../../api/transactions/upsert_match';
import transactionsUpsertMonthly from '../../api/transactions/upsert_monthly';
import groupsRequestJoin from '../../api/groups/[id]/request_join';
import groupsPromoteMember from '../../api/groups/[id]/promote_member';
import groupsDemoteMember from '../../api/groups/[id]/demote_member';
import groupsCancelRequest from '../../api/groups/[id]/cancel_request';
import groupsRejectRequest from '../../api/groups/[id]/reject_request';
import rankingPoints from '../../api/ranking/points';
import groupsRequests from '../../api/groups/[id]/requests';
import groupsApproveRequest from '../../api/groups/[id]/approve_request';
import ownerFieldsIndex from '../../api/owner/fields/index';
import ownerFieldsId from '../../api/owner/fields/[id]';
import ownerFieldsSlots from '../../api/owner/fields/[id]/slots';
import fieldsSearch from '../../api/fields/search';
import ownerVenuesIndex from '../../api/owner/venues/index';
import ownerVenuesId from '../../api/owner/venues/[id]';
import pushSubscribe from '../../api/push/subscribe';
import pushSend from '../../api/push/send';
import aiBalance from '../../api/ai/balance';
import achievementsIndex from '../../api/achievements/index';
import achievementsAward from '../../api/achievements/award';
import leaderboard from '../../api/achievements/leaderboard';
import whatsappShare from '../../api/whatsapp/share';
import whatsappInvite from '../../api/whatsapp/invite';
import marketplaceSearch from '../../api/marketplace/search';
import marketplaceBook from '../../api/marketplace/book';
import marketplaceReviews from '../../api/marketplace/reviews';
import marketplaceAvailability from '../../api/marketplace/availability';

type LegacyHandler = (req: Request, res: Response) => void | Promise<void>;

async function legacy(
  h: LegacyHandler,
  req: Request,
  res: Response,
): Promise<void> {
  await h(req, res);
}

@Controller('api/groups')
export class GroupsRestController {
  @Get()
  async index(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(groupsIndex, req, res);
  }

  @Get('by_user')
  async byUser(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(groupsByUser, req, res);
  }

  @Put(':id')
  async update(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(groupsId, req, res);
  }

  /** Rotas mais específicas antes de `:id/members`. */
  @All(':id/members/batch')
  async membersBatch(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(groupsMembers, req, res);
  }

  @Delete(':id/members/:playerId')
  async membersDelete(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(groupsMembers, req, res);
  }

  @All(':id/members')
  async members(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(groupsMembers, req, res);
  }

  @Post(':id/request_join')
  async requestJoin(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(groupsRequestJoin, req, res);
  }

  @Get(':id/requests')
  async requests(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(groupsRequests, req, res);
  }

  @Post(':id/approve_request')
  async approveRequest(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(groupsApproveRequest, req, res);
  }

  @Post(':id/promote_member')
  async promote(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(groupsPromoteMember, req, res);
  }

  @Post(':id/demote_member')
  async demote(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(groupsDemoteMember, req, res);
  }

  @Post(':id/cancel_request')
  async cancelRequest(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(groupsCancelRequest, req, res);
  }

  @Post(':id/reject_request')
  async rejectRequest(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(groupsRejectRequest, req, res);
  }
}

@Controller('api')
export class CatalogRestController {
  @Get('teams')
  async teams(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(teamsIndex, req, res);
  }

  @Get('positions')
  async positions(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(positionsIndex, req, res);
  }
}

@Controller('api/players')
export class PlayersRestController {
  @Get()
  async index(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(playersIndex, req, res);
  }

  @Put(':id')
  async update(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(playersId, req, res);
  }

  @Post('update_by_user')
  async updateByUser(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(playersUpdateByUser, req, res);
  }
}

@Controller('api/fields')
export class FieldsRestController {
  @Get()
  async index(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(fieldsIndex, req, res);
  }

  @Get('search')
  async search(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(fieldsSearch, req, res);
  }

  @Put(':id')
  async update(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(fieldsId, req, res);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(fieldsId, req, res);
  }
}

@Controller('api/matches')
export class MatchesRestController {
  @Get()
  async index(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(matchesIndex, req, res);
  }

  @Put(':id')
  async update(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(matchesId, req, res);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(matchesId, req, res);
  }

  @Post(':id/reopen')
  async reopen(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(matchesReopen, req, res);
  }

  @Post(':id/cancel')
  async cancel(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(matchesCancel, req, res);
  }

  @Post(':id/vote')
  async vote(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(matchesVote, req, res);
  }

  @Get(':id/votes')
  async votes(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(matchesVotes, req, res);
  }
}

@Controller('api/ranking')
export class RankingRestController {
  @Get('points')
  async points(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(rankingPoints, req, res);
  }
}

@Controller('api/transactions')
export class TransactionsRestController {
  @Get()
  async index(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(transactionsIndex, req, res);
  }

  @Put(':id')
  async update(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(transactionsId, req, res);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(transactionsId, req, res);
  }

  @Post('upsert_match')
  async upsertMatch(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(transactionsUpsertMatch, req, res);
  }

  @Post('upsert_monthly')
  async upsertMonthly(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(transactionsUpsertMonthly, req, res);
  }
}

@Controller('api/owner/fields')
export class OwnerFieldsRestController {
  @All()
  async index(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(ownerFieldsIndex, req, res);
  }

  @All(':id')
  async byId(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(ownerFieldsId, req, res);
  }

  @All(':id/slots')
  async slots(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(ownerFieldsSlots, req, res);
  }
}

@Controller('api/owner/venues')
export class OwnerVenuesRestController {
  @All()
  async index(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(ownerVenuesIndex, req, res);
  }

  @All(':id')
  async byId(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(ownerVenuesId, req, res);
  }
}

@Controller('api/push')
export class PushRestController {
  @Post('subscribe')
  async subscribe(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(pushSubscribe, req, res);
  }

  @Post('send')
  async send(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(pushSend, req, res);
  }
}

@Controller('api/ai')
export class AiRestController {
  @Post('balance')
  async balance(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(aiBalance, req, res);
  }
}

@Controller('api/achievements')
export class AchievementsRestController {
  @Get()
  async index(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(achievementsIndex, req, res);
  }

  @Post('award')
  async award(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(achievementsAward, req, res);
  }

  @Get('leaderboard')
  async leaderboard(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(leaderboard, req, res);
  }
}

@Controller('api/whatsapp')
export class WhatsappRestController {
  @Post('share')
  async share(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(whatsappShare, req, res);
  }

  @Get('invite/:groupId')
  async invite(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(whatsappInvite, req, res);
  }
}

@Controller('api/marketplace')
export class MarketplaceRestController {
  @Get('search')
  async search(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(marketplaceSearch, req, res);
  }

  @Get('availability')
  async availability(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(marketplaceAvailability, req, res);
  }

  @Post('book')
  async book(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(marketplaceBook, req, res);
  }

  @All('reviews/:fieldId')
  async reviews(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await legacy(marketplaceReviews, req, res);
  }
}
