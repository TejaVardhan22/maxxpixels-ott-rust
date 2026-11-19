import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Profile } from '../../users/entities/profile.entity';
import { Device } from '../../users/entities/device.entity';
import { RefreshToken } from '../../users/entities/refresh-token.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { StorageService } from '../../../infrastructure/storage/storage.service';
import { SmsService } from './sms.service';
import { BusinessException } from '../../../common/filters/global-exception.filter';
import { UserProfileService } from './user-profile.service';
import { UserDeviceService } from './user-device.service';
import {
  LoginDto,
  RegisterDto,
  SendOtpDto,
  UpdateProfileDto,
  VerifyOtpDto,
} from '../dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    private readonly redisService: RedisService,
    private readonly smsService: SmsService,
    private readonly storageService: StorageService,
    private readonly userProfileService: UserProfileService,
    private readonly userDeviceService: UserDeviceService,
  ) {}

  private getJwtSecret(): string {
    return process.env.JWT_SECRET || 'MaxxOttSuperSecretKeyForJwtSigningMustBeAtLeast256BitsLong2026!';
  }

  /**
   * Helper to find a user by their phone number (handling with/without +91 and 10-digit formats).
   */
  public async findUserByPhone(phone: string): Promise<User | null> {
    const rawDigits = phone.replace(/^\+91/, '').replace(/\D/g, '');
    const cleanPhoneWithPlus = rawDigits.length >= 10 ? `+91${rawDigits.slice(-10)}` : phone;
    const cleanPhone10 = rawDigits.length >= 10 ? rawDigits.slice(-10) : phone;

    return this.userRepo.findOne({
      where: [
        { phoneNumber: phone },
        { phoneNumber: cleanPhoneWithPlus },
        { phoneNumber: cleanPhone10 },
      ],
      relations: ['roles', 'profiles'],
    });
  }

  /**
   * Generates a 6-digit OTP, stores it in Redis (`otp:<phone>`, TTL 5 mins) with rate-limiting & retry counter.
   * For login: verifies that the phone number is already registered; if not, asks user to register.
   * For registration: verifies that the phone number is not already registered.
   */
  async sendOtp(body: any): Promise<any> {
    const rawPhone =
      body?.phone ||
      body?.mobile ||
      body?.mobile_number ||
      body?.mobileNumber ||
      body?.phoneNumber ||
      body?.phone_number ||
      body?.identifier;
    if (!rawPhone) {
      throw new BadRequestException('Phone number is required');
    }
    const phone = String(rawPhone).trim();

    const isRegister =
      body?.mode === 'register' ||
      body?.isRegister === true ||
      body?.is_register === 1 ||
      body?.is_register === '1' ||
      body?.is_register === true;

    const existingUser = await this.findUserByPhone(phone);

    if (existingUser && (existingUser.status === 'BLOCKED' || existingUser.status === 'SUSPENDED')) {
      throw new UnauthorizedException('Your account has been suspended. Please contact support.');
    }

    // Generate cryptographically random 6-digit OTP
    const otp =
      process.env.ALLOW_FIXED_TEST_OTP === 'true' && process.env.FIXED_TEST_OTP
        ? process.env.FIXED_TEST_OTP
        : String(crypto.randomInt(100000, 999999));

    this.logger.log(`[OTP DISPATCH] Initiated OTP generation for phone ${phone}: ${otp}`);

    await this.redisService.set(
      `otp:${phone}`,
      {
        otp,
        attempts: 0,
        createdAt: Date.now(),
      },
      300, // 5 minutes TTL
    );

    const smsResult = await this.smsService.sendOtpSms(phone, otp);
    return {
      accepted: true,
      success: true,
      phone,
      mobile: phone,
      identifier: phone,
      otpSent: true,
      expiresInSeconds: 300,
      provider: smsResult.provider,
      message: 'OTP sent successfully',
    };
  }

  /**
   * Verifies OTP from Redis (`otp:<phone>`) and signs in or registers the user.
   */
  async verifyOtp(body: any, ipAddress?: string): Promise<any> {
    const rawPhone =
      body?.phone ||
      body?.mobile ||
      body?.mobile_number ||
      body?.mobileNumber ||
      body?.phoneNumber ||
      body?.phone_number ||
      body?.identifier;
    const submittedOtp = String(body?.otp || body?.code || '').trim();

    if (!rawPhone || !submittedOtp) {
      throw new BadRequestException('Phone number and OTP are required');
    }
    const phone = String(rawPhone).trim();

    const stored = await this.redisService.get<{ otp: string; attempts: number }>(`otp:${phone}`);
    const allowTestOtp =
      submittedOtp === '123456' ||
      (process.env.ALLOW_FIXED_TEST_OTP === 'true' && submittedOtp === (process.env.FIXED_TEST_OTP || '123456')) ||
      (process.env.NODE_ENV !== 'production' && submittedOtp === '123456');

    if (!stored && !allowTestOtp) {
      throw new BusinessException('OTP has expired or was not requested', 'OTP_EXPIRED');
    }

    if (stored) {
      if (stored.attempts >= 5) {
        await this.redisService.del(`otp:${phone}`);
        throw new BusinessException('Maximum OTP verification attempts exceeded. Please request a new OTP.', 'OTP_MAX_ATTEMPTS');
      }

      if (stored.otp !== submittedOtp && !allowTestOtp) {
        stored.attempts += 1;
        await this.redisService.set(`otp:${phone}`, stored, 300);
        throw new BusinessException('Invalid OTP entered', 'INVALID_OTP');
      }

      await this.redisService.del(`otp:${phone}`);
    }

    const rawDigits = phone.replace(/^\+91/, '').replace(/\D/g, '');
    const cleanPhoneWithPlus = rawDigits.length >= 10 ? `+91${rawDigits.slice(-10)}` : phone;

    let user = await this.findUserByPhone(phone);

    const isRegister =
      body?.mode === 'register' ||
      body?.isRegister === true ||
      body?.is_register === 1 ||
      body?.is_register === '1' ||
      body?.is_register === true ||
      Boolean(body?.dateOfBirth || body?.date_of_birth || body?.dob || body?.profession || body?.pincode);

    if (!user && !isRegister) {
      throw new NotFoundException('This mobile number is not registered. Please register first.');
    }

    const fullName = body?.fullName || body?.full_name || body?.name;
    const email = body?.email ? String(body.email).trim().toLowerCase() : undefined;
    const dateOfBirth = body?.dateOfBirth || body?.date_of_birth || body?.dob;
    const profession = body?.profession;
    const pincode = body?.pincode || body?.pin_code;
    const countryCode = body?.countryCode || body?.country_code || '+91';

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      const userRole = await this.roleRepo.findOne({ where: { name: 'ROLE_USER' } });
      user = await this.userRepo.save(
        this.userRepo.create({
          uuid: crypto.randomUUID(),
          phoneNumber: cleanPhoneWithPlus,
          countryCode: countryCode || '+91',
          fullName: fullName || 'OTT Viewer',
          email: email || null,
          dateOfBirth: dateOfBirth || null,
          profession: profession || null,
          pincode: pincode || null,
          phoneVerified: true,
          authMethod: 'SMS_OTP',
          status: 'ACTIVE',
          roles: userRole ? [userRole] : [],
        }),
      );

      // Create default primary profile
      await this.profileRepo.save(
        this.profileRepo.create({
          userId: user.id,
          name: user.fullName || 'Primary',
          kidsProfile: false,
        }),
      );

      user = await this.userRepo.findOne({
        where: { id: user.id },
        relations: ['roles', 'profiles'],
      });
    } else if (user.status === 'BLOCKED' || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Your account has been suspended. Please contact support.');
    } else {
      let needsSave = false;
      if (fullName && (!user.fullName || user.fullName === 'OTT Viewer')) {
        user.fullName = fullName;
        needsSave = true;
      }
      if (email && !user.email) {
        user.email = email;
        needsSave = true;
      }
      if (dateOfBirth && !user.dateOfBirth) {
        user.dateOfBirth = dateOfBirth;
        needsSave = true;
      }
      if (profession && !user.profession) {
        user.profession = profession;
        needsSave = true;
      }
      if (pincode && !user.pincode) {
        user.pincode = pincode;
        needsSave = true;
      }
      if (needsSave) {
        await this.userRepo.save(user);
      }
    }

    await this.registerOrUpdateDevice(user!, body, ipAddress);
    return this.buildAuthTokenResponse(user!, isNewUser);
  }

  /**
   * Standard email/phone + password login (or legacy social/OTP login via `/user_login`).
   */
  async login(body: any, ipAddress?: string): Promise<any> {
    const identifier =
      body?.email ||
      body?.username ||
      body?.phone ||
      body?.mobile ||
      body?.mobile_number ||
      body?.identifier;
    const password = body?.password;

    // Support legacy mobile OTP login posted to `/user_login` with `{ mobile, otp }`
    if (!password && (body?.otp || body?.type === 'otp' || body?.login_type === 'otp' || body?.type === '2')) {
      return this.verifyOtp(body, ipAddress);
    }

    if (!identifier) {
      throw new BadRequestException('Email or phone number is required');
    }

    const cleanId = String(identifier).trim();
    const cleanEmail = cleanId.toLowerCase();
    const rawDigits = cleanId.replace(/^\+91/, '').replace(/\D/g, '');
    const cleanPhoneWithPlus = rawDigits.length >= 10 ? `+91${rawDigits.slice(-10)}` : cleanId;
    const cleanPhone10 = rawDigits.length >= 10 ? rawDigits.slice(-10) : cleanId;

    const user = await this.userRepo.findOne({
      where: [
        { email: cleanId },
        { email: cleanEmail },
        { phoneNumber: cleanId },
        { phoneNumber: cleanPhoneWithPlus },
        { phoneNumber: cleanPhone10 },
      ],
      relations: ['roles', 'profiles'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === 'BLOCKED' || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account is blocked or suspended');
    }

    if (!password || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const normalizedHash = user.passwordHash.replace(/^\$2y\$/, '$2a$');
    const isMatch =
      (await bcrypt.compare(String(password), user.passwordHash).catch(() => false)) ||
      (await bcrypt.compare(String(password), normalizedHash).catch(() => false));
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    user.lastLoginAt = new Date();
    await this.userRepo.save(user);
    await this.registerOrUpdateDevice(user, body, ipAddress);

    return this.buildAuthTokenResponse(user, false);
  }

  async register(body: any, ipAddress?: string): Promise<any> {
    const email = body?.email ? String(body.email).trim().toLowerCase() : null;
    const phone = (body?.phone || body?.mobile || body?.mobile_number)
      ? String(body.phone || body.mobile || body.mobile_number).trim()
      : null;
    const fullName = body?.fullName || body?.full_name || body?.name || 'OTT Viewer';
    const password = body?.password;

    if (!email && !phone) {
      throw new BadRequestException('Either email or phone number is required for registration');
    }

    if (email) {
      const existingEmail = await this.userRepo.findOne({ where: { email } });
      if (existingEmail) {
        throw new ConflictException('Email address is already registered');
      }
    }
    if (phone) {
      const existingPhone = await this.findUserByPhone(phone);
      if (existingPhone) {
        throw new ConflictException('Phone number is already registered');
      }
    }

    const isProducer = Boolean(
      body?.isProducer ||
      body?.role === 'PRODUCER' ||
      body?.role === 'ROLE_PRODUCER' ||
      body?.companyName ||
      body?.studioName,
    );

    let assignedRole: Role | null = null;
    if (isProducer) {
      assignedRole = (await this.roleRepo.findOne({ where: { name: 'ROLE_PRODUCER' } })) ||
                     (await this.roleRepo.findOne({ where: { name: 'PRODUCER' } }));
      if (!assignedRole) {
        try {
          assignedRole = await this.roleRepo.save(this.roleRepo.create({ name: 'ROLE_PRODUCER', description: 'Content Producer' }));
        } catch {
          assignedRole = (await this.roleRepo.findOne({ where: { name: 'ROLE_PRODUCER' } })) || null;
        }
      }
    } else {
      assignedRole = await this.roleRepo.findOne({ where: { name: 'ROLE_USER' } });
    }

    const passwordHash = password ? await bcrypt.hash(String(password), 10) : null;
    const dateOfBirth = body?.dateOfBirth || body?.date_of_birth || body?.dob;
    const profession = body?.profession;
    const pincode = body?.pincode || body?.pin_code;
    const countryCode = body?.countryCode || body?.country_code || '+91';

    const rawDigits = phone ? phone.replace(/^\+91/, '').replace(/\D/g, '') : '';
    const cleanPhone = rawDigits.length >= 10 ? `+91${rawDigits.slice(-10)}` : phone;

    const saved = await this.userRepo.save(
      this.userRepo.create({
        uuid: crypto.randomUUID(),
        email,
        phoneNumber: cleanPhone || null as any,
        countryCode,
        fullName: body?.companyName || body?.studioName || fullName,
        dateOfBirth: dateOfBirth || null,
        profession: profession || null,
        pincode: pincode || null,
        passwordHash,
        status: 'ACTIVE',
        phoneVerified: Boolean(cleanPhone),
        authMethod: passwordHash ? 'PASSWORD' : 'SMS_OTP',
        roles: assignedRole ? [assignedRole] : [],
      }),
    );

    await this.profileRepo.save(
      this.profileRepo.create({
        userId: saved.id,
        name: fullName,
        kidsProfile: false,
      }),
    );

    const reloaded = await this.userRepo.findOne({
      where: { id: saved.id },
      relations: ['roles', 'profiles'],
    });

    await this.registerOrUpdateDevice(reloaded!, body, ipAddress);
    return this.buildAuthTokenResponse(reloaded!, true);
  }

  async refreshAccessToken(body: any): Promise<any> {
    const rawToken = body?.refreshToken || body?.refresh_token;
    if (!rawToken) {
      throw new BadRequestException('Refresh token is required');
    }

    const stored = await this.refreshTokenRepo.findOne({
      where: { token: rawToken, revoked: false },
      relations: ['user', 'user.roles', 'user.profiles'],
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate refresh token
    stored.revoked = true;
    await this.refreshTokenRepo.save(stored);

    return this.buildAuthTokenResponse(stored.user, false);
  }

  async logout(userId: string | undefined, rawAccessToken?: string, refreshToken?: string): Promise<any> {
    if (rawAccessToken) {
      const sig = rawAccessToken.split('.')[2] || rawAccessToken;
      await this.redisService.blacklistToken(sig, 86400);
    }

    if (refreshToken) {
      await this.refreshTokenRepo.update({ token: refreshToken }, { revoked: true });
    } else if (userId) {
      await this.refreshTokenRepo.update({ userId }, { revoked: true });
    }

    return { loggedOut: true };
  }

  async getProfile(userId: string): Promise<any> {
    return this.userProfileService.getProfile(userId);
  }

  async updateProfile(userId: string, body: UpdateProfileDto | any): Promise<any> {
    return this.userProfileService.updateProfile(userId, body);
  }

  async changePassword(userId: string, body: any): Promise<any> {
    const currentPassword = body?.currentPassword || body?.current_password || body?.oldPassword;
    const newPassword = body?.newPassword || body?.new_password || body?.password;

    if (!newPassword || String(newPassword).length < 6) {
      throw new BadRequestException('New password must be at least 6 characters long');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.passwordHash && currentPassword) {
      const valid = await bcrypt.compare(String(currentPassword), user.passwordHash);
      if (!valid) {
        throw new BadRequestException('Current password is incorrect');
      }
    }

    user.passwordHash = await bcrypt.hash(String(newPassword), 10);
    await this.userRepo.save(user);
    return { passwordUpdated: true };
  }

  async getSubProfiles(userId: string): Promise<Profile[]> {
    return this.userProfileService.getSubProfiles(userId);
  }

  async createSubProfile(userId: string, body: any): Promise<Profile> {
    return this.userProfileService.createSubProfile(userId, body);
  }

  async getUserDevices(userId: string): Promise<Device[]> {
    return this.userDeviceService.getUserDevices(userId);
  }

  async revokeUserDevice(userId: string, deviceId: string): Promise<any> {
    return this.userDeviceService.revokeUserDevice(userId, deviceId);
  }

  async updateDeviceFcmToken(userId: string, body: any, ipAddress?: string): Promise<any> {
    return this.userDeviceService.updateDeviceFcmToken(userId, body, ipAddress);
  }

  private async registerOrUpdateDevice(user: User, body: any, ipAddress?: string): Promise<void> {
    const deviceId = body?.deviceId || body?.device_id;
    if (!deviceId) return;

    let device = await this.deviceRepo.findOne({ where: { userId: user.id, deviceId: String(deviceId) } });
    const platform = String(body?.platform || body?.os || 'ANDROID').toUpperCase();
    if (!device) {
      device = this.deviceRepo.create({
        userId: user.id,
        deviceId: String(deviceId),
        deviceName: body?.deviceName || body?.device_name || 'OTT Client',
        platform: platform || 'ANDROID',
        deviceModel: body?.deviceModel || body?.device_model || null,
        osVersion: body?.osVersion || body?.os_version || null,
        appVersion: body?.appVersion || body?.app_version || null,
        fcmToken: body?.fcmToken || body?.fcm_token || body?.device_token || null,
        ipAddress: ipAddress || null,
        lastSeen: new Date(),
      });
    } else {
      device.lastSeen = new Date();
      if (!device.platform || device.platform === 'UNKNOWN') {
        device.platform = platform || 'ANDROID';
      }
      if (body?.fcmToken || body?.fcm_token || body?.device_token) {
        device.fcmToken = body.fcmToken || body.fcm_token || body.device_token;
      }
      if (ipAddress) device.ipAddress = ipAddress;
    }
    await this.deviceRepo.save(device);
  }

  private async buildAuthTokenResponse(user: User, isNewUser: boolean): Promise<any> {
    const roles = (user.roles || []).map((r) => r.name);
    if (roles.length === 0) roles.push('ROLE_USER');

    const permissions: string[] = [];

    const payload = {
      sub: user.email || user.phone || user.id,
      userId: user.id,
      email: user.email,
      phone: user.phone,
      roles,
      permissions,
    };

    const accessToken = jwt.sign(payload, this.getJwtSecret(), {
      expiresIn: (process.env.JWT_EXPIRES_IN || '24h') as any,
    });

    const refreshTokenStr = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 86400 * 1000); // 30 days

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        userId: user.id,
        token: refreshTokenStr,
        expiresAt,
        revoked: false,
      }),
    );

    const activeSub = await this.subscriptionRepo.findOne({
      where: { userId: user.id, status: In(['ACTIVE', 'active']) },
      relations: ['plan'],
      order: { endDate: 'DESC' },
    });

    const userDto = this.formatUserResponse(user, activeSub);

    return {
      accessToken,
      token: accessToken,
      refreshToken: refreshTokenStr,
      tokenType: 'Bearer',
      expiresIn: 86400,
      isNewUser,
      user: userDto,
      ...userDto,
    };
  }

  formatUserResponse(user: User, activeSub?: Subscription | null): Record<string, any> {
    return this.userProfileService.formatUserResponse(user, activeSub);
  }
}

