import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Profile } from '../../users/entities/profile.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { StorageService } from '../../../infrastructure/storage/storage.service';
import { BusinessException } from '../../../common/filters/global-exception.filter';

@Injectable()
export class UserProfileService {
  private readonly logger = new Logger(UserProfileService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    private readonly storageService: StorageService,
  ) {}

  async getProfile(userId: string): Promise<any> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['roles', 'profiles'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const activeSub = await this.subscriptionRepo.findOne({
      where: { userId: user.id, status: In(['ACTIVE', 'active']) },
      relations: ['plan'],
      order: { endDate: 'DESC' },
    });

    return this.formatUserResponse(user, activeSub);
  }

  async updateProfile(userId: string, body: any): Promise<any> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['roles', 'profiles'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (body.fullName !== undefined || body.full_name !== undefined || body.name !== undefined) {
      user.fullName = body.fullName ?? body.full_name ?? body.name;
    }
    if (body.email !== undefined && body.email !== user.email) {
      user.email = body.email;
    }

    // Handle avatar upload via base64 or CDN URL
    const rawBase64 =
      body.avatarBase64 ||
      body.imageBase64 ||
      (typeof body.avatarUrl === 'string' && body.avatarUrl.startsWith('data:image/') ? body.avatarUrl : undefined) ||
      (typeof body.image === 'string' && body.image.startsWith('data:image/') ? body.image : undefined);

    if (rawBase64 && typeof rawBase64 === 'string') {
      try {
        const cleanBase64 = rawBase64.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        const mimeType = body.imageType || body.contentType || 'image/jpeg';
        const ext = mimeType.includes('png') ? '.png' : mimeType.includes('webp') ? '.webp' : '.jpg';
        const fileName = `avatar_${userId}_${Date.now()}${ext}`;
        const uploadResult = await this.storageService.uploadFile('avatars', fileName, buffer, mimeType);
        if (uploadResult?.url) {
          user.avatarUrl = uploadResult.url;
        }
      } catch (err: any) {
        this.logger.warn(`Failed to process avatarBase64: ${err?.message}`);
      }
    } else if (body.avatarUrl !== undefined || body.avatar_url !== undefined || body.image !== undefined) {
      const candidateUrl = body.avatarUrl ?? body.avatar_url ?? body.image;
      if (candidateUrl && typeof candidateUrl === 'string' && candidateUrl.trim().length > 0) {
        user.avatarUrl = candidateUrl.trim();
      }
    }

    if (body.dateOfBirth !== undefined || body.date_of_birth !== undefined || body.dob !== undefined) {
      user.dateOfBirth = body.dateOfBirth ?? body.date_of_birth ?? body.dob;
    }
    if (body.profession !== undefined) {
      user.profession = body.profession;
    }
    if (body.pincode !== undefined || body.pin_code !== undefined || body.postal_code !== undefined) {
      user.pincode = body.pincode ?? body.pin_code ?? body.postal_code;
    }
    if (body.preferredLanguages !== undefined || body.preferred_languages !== undefined) {
      const langs = body.preferredLanguages ?? body.preferred_languages;
      user.preferredLanguages = Array.isArray(langs) ? langs.join(',') : String(langs);
    }

    await this.userRepo.save(user);

    // Synchronize default profile avatar if sub-profiles exist
    if (user.profiles && user.profiles.length > 0) {
      const defaultProf = user.profiles.find((p) => p.isDefault) || user.profiles[0];
      if (defaultProf) {
        defaultProf.avatarUrl = user.avatarUrl;
        if (user.fullName) defaultProf.name = user.fullName;
        await this.profileRepo.save(defaultProf);
      }
    }

    return this.getProfile(userId);
  }

  async getSubProfiles(userId: string): Promise<Profile[]> {
    return this.profileRepo.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
  }

  async createSubProfile(userId: string, body: any): Promise<Profile> {
    const existingCount = await this.profileRepo.count({ where: { userId } });
    if (existingCount >= 5) {
      throw new BusinessException('Maximum 5 profiles allowed per account', 'MAX_PROFILES_REACHED');
    }

    const profile = this.profileRepo.create({
      userId,
      name: body?.name || 'Viewer',
      avatarUrl: body?.avatarUrl || body?.avatar_url || null,
      isKids: Boolean(body?.isKids ?? body?.is_kids ?? false),
      pinCode: body?.pinCode || body?.pin_code || null,
      preferredLanguage: body?.preferredLanguage || body?.preferred_language || 'hi',
      isDefault: existingCount === 0,
    });
    return this.profileRepo.save(profile);
  }

  formatUserResponse(user: User, activeSub?: Subscription | null): any {
    const isSubscribed = Boolean(
      activeSub &&
      (!activeSub.endDate || new Date(activeSub.endDate).getTime() > Date.now())
    );
    const isBuy = isSubscribed ? 1 : 0;
    const pkgName = activeSub?.plan?.name || (isSubscribed ? 'VIP Membership' : 'Free');
    const expiry = activeSub?.endDate ? new Date(activeSub.endDate).toISOString() : null;
    const planId = activeSub?.planId || 0;
    const phoneNum = user.phone || user.phoneNumber || (user as any).mobileNumber || '';

    const basePermissions: string[] = [];

    return {
      id: user.id,
      user_id: user.id,
      userId: user.id,
      email: user.email || '',
      phone: phoneNum,
      mobile: phoneNum,
      mobileNumber: phoneNum,
      mobile_number: phoneNum,
      phoneNumber: phoneNum,
      phone_number: phoneNum,
      fullName: user.fullName,
      full_name: user.fullName,
      name: user.fullName,
      userName: user.fullName,
      user_name: user.fullName,
      avatarUrl: user.avatarUrl,
      avatar_url: user.avatarUrl,
      image: user.avatarUrl,
      dateOfBirth: user.dateOfBirth,
      date_of_birth: user.dateOfBirth,
      dob: user.dateOfBirth,
      profession: user.profession,
      pincode: user.pincode,
      pin_code: user.pincode,
      postal_code: user.pincode,
      status: user.status || 'ACTIVE',
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      preferredLanguages: user.preferredLanguages ? user.preferredLanguages.split(',') : ['hi'],
      preferred_languages: user.preferredLanguages ? user.preferredLanguages.split(',') : ['hi'],
      isSubscribed,
      is_subscribed: isSubscribed,
      subscribed: isSubscribed,
      isBuy,
      is_buy: isBuy,
      is_buy_package: isBuy,
      packageName: pkgName,
      package_name: pkgName,
      package_title: pkgName,
      planName: pkgName,
      plan_name: pkgName,
      planId,
      plan_id: planId,
      package_id: planId,
      expiryDate: expiry,
      expire_date: expiry,
      expiry_date: expiry,
      end_date: expiry,
      endDate: expiry,
      subscription_status: activeSub ? activeSub.status : 'INACTIVE',
      subscription_expires_at: expiry,
      subscription: activeSub
        ? {
            id: activeSub.id,
            planId: activeSub.planId,
            planName: activeSub.plan?.name,
            status: activeSub.status,
            startDate: activeSub.startDate,
            endDate: activeSub.endDate,
          }
        : null,
      roles: (user.roles || []).map((r) => r.name),
      permissions: Array.from(new Set(basePermissions)),
      profiles: user.profiles || [],
      createdAt: user.createdAt,
      created_at: user.createdAt,
    };
  }
}
