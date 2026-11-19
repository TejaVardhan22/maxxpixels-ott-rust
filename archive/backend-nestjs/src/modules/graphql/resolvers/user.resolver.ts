import { Query, Resolver } from '@nestjs/graphql';
import { UnauthorizedException } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/auth.decorators';
import { UserProfileService } from '../../auth/services/user-profile.service';
import { UserDeviceService } from '../../auth/services/user-device.service';
import { SubProfileType, UserDeviceType, UserProfileType } from '../types/user.types';

@Resolver()
export class UserResolver {
  constructor(
    private readonly userProfileService: UserProfileService,
    private readonly userDeviceService: UserDeviceService,
  ) {}

  @Query(() => UserProfileType, { description: 'Get currently authenticated user profile' })
  async me(@CurrentUser() user?: AuthenticatedUser): Promise<UserProfileType> {
    if (!user?.id) {
      throw new UnauthorizedException('Authentication required');
    }
    const profile = await this.userProfileService.getProfile(user.id);
    const subProfilesRaw = await this.userProfileService.getSubProfiles(user.id).catch(() => []);

    return {
      id: String(profile.id),
      name: profile.name || '',
      email: profile.email || '',
      phone: profile.phoneNumber || profile.phone || '',
      avatarUrl: profile.avatarUrl || '',
      role: profile.roles?.[0] || 'USER',
      activeSubscription: profile.activeSubscription
        ? {
            id: String(profile.activeSubscription.id || ''),
            planId: String(profile.activeSubscription.planId || ''),
            planName: profile.activeSubscription.planName || 'Standard',
            status: profile.activeSubscription.status || 'ACTIVE',
            startsAt: profile.activeSubscription.startsAt?.toISOString?.() || undefined,
            expiresAt: profile.activeSubscription.expiresAt?.toISOString?.() || undefined,
          }
        : undefined,
      subProfiles: (subProfilesRaw || []).map((sp: any) => ({
        id: String(sp.id),
        name: sp.name || '',
        avatarUrl: sp.avatarUrl || '',
        isKids: Boolean(sp.isKids),
        isPinProtected: Boolean(sp.pin),
      })),
    };
  }

  @Query(() => [SubProfileType], { description: 'Get sub-profiles for authenticated account' })
  async subProfiles(@CurrentUser() user?: AuthenticatedUser): Promise<SubProfileType[]> {
    if (!user?.id) {
      throw new UnauthorizedException('Authentication required');
    }
    const raw = await this.userProfileService.getSubProfiles(user.id);
    return (raw || []).map((sp: any) => ({
      id: String(sp.id),
      name: sp.name || '',
      avatarUrl: sp.avatarUrl || '',
      isKids: Boolean(sp.isKids),
      isPinProtected: Boolean(sp.pin),
    }));
  }

  @Query(() => [UserDeviceType], { description: 'Get active logged-in devices for authenticated account' })
  async userDevices(@CurrentUser() user?: AuthenticatedUser): Promise<UserDeviceType[]> {
    if (!user?.id) {
      throw new UnauthorizedException('Authentication required');
    }
    const raw = await this.userDeviceService.getUserDevices(user.id);
    return (raw || []).map((d: any) => ({
      id: String(d.id),
      deviceId: d.deviceId || '',
      deviceName: d.deviceName || d.deviceModel || 'Unknown Device',
      deviceType: d.deviceType || 'MOBILE',
      ipAddress: d.ipAddress || '',
      lastActiveAt: d.lastActiveAt?.toISOString?.() || undefined,
    }));
  }
}

