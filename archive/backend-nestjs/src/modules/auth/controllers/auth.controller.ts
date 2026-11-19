import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Public,
  CurrentUser,
  AuthenticatedUser,
} from '../../../common/decorators/auth.decorators';
import { AuthService } from '../services/auth.service';
import {
  LoginDto,
  RegisterDto,
  SendOtpDto,
  UpdateProfileDto,
  VerifyOtpDto,
} from '../dto/auth.dto';

@ApiTags('Authentication & User Profile')
@Controller(['api/v1/auth', 'api/auth', 'auth'])
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post(['send-otp', 'resend-otp', 'otp/send'])
  @ApiOperation({ summary: 'Send 6-digit OTP to mobile phone' })
  async sendOtp(@Body() body: SendOtpDto) {
    return this.authService.sendOtp(body);
  }

  @Public()
  @Post(['verify-otp', 'firebase-verify', 'otp/verify'])
  @ApiOperation({ summary: 'Verify mobile OTP and issue JWT access + refresh tokens' })
  async verifyOtp(@Body() body: VerifyOtpDto, @Req() req: any) {
    return this.authService.verifyOtp(body, req?.ip);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Authenticate user with email/phone and password' })
  async login(@Body() body: LoginDto, @Req() req: any) {
    return this.authService.login(body, req?.ip);
  }

  @Public()
  @Post(['register', 'signup'])
  @ApiOperation({ summary: 'Register a new user account' })
  async register(@Body() body: RegisterDto, @Req() req: any) {
    return this.authService.register(body, req?.ip);
  }

  @Public()
  @Post(['refresh', 'refresh-token'])
  @ApiOperation({ summary: 'Refresh JWT access token using refresh token' })
  async refresh(@Body() body: any) {
    return this.authService.refreshAccessToken(body);
  }

  @ApiBearerAuth()
  @Post('logout')
  @ApiOperation({ summary: 'Revoke refresh token and blacklist active JWT' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('authorization') authHeader?: string,
    @Body() body?: any,
  ) {
    const rawAccess = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
    return this.authService.logout(user?.id, rawAccess, body?.refreshToken);
  }

  @ApiBearerAuth()
  @Get(['me', 'profile'])
  @ApiOperation({ summary: 'Get authenticated user profile and active subscription' })
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.id);
  }

  @ApiBearerAuth()
  @Put(['me', 'profile'])
  @ApiOperation({ summary: 'Update authenticated user profile' })
  async updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, body);
  }

  @ApiBearerAuth()
  @Post(['change-password', 'password'])
  @ApiOperation({ summary: 'Change authenticated user password' })
  async changePassword(@CurrentUser() user: AuthenticatedUser, @Body() body: any) {
    return this.authService.changePassword(user.id, body);
  }

  @ApiBearerAuth()
  @Get('profiles')
  @ApiOperation({ summary: 'List family sub-profiles for authenticated user' })
  async getSubProfiles(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getSubProfiles(user.id);
  }

  @ApiBearerAuth()
  @Post('profiles')
  @ApiOperation({ summary: 'Create a new family sub-profile' })
  async createSubProfile(@CurrentUser() user: AuthenticatedUser, @Body() body: any) {
    return this.authService.createSubProfile(user.id, body);
  }

  @ApiBearerAuth()
  @Post(['device-token', 'fcm-token'])
  @ApiOperation({ summary: 'Register or update device FCM push token' })
  async updateDeviceToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.authService.updateDeviceFcmToken(user.id, body, req?.ip);
  }
}

@ApiTags('User Sub-Profiles & Devices')
@ApiBearerAuth()
@Controller(['api/v1', 'api'])
export class ProfileDeviceController {
  constructor(private readonly authService: AuthService) {}

  @Get('profiles')
  @ApiOperation({ summary: 'List family sub-profiles for authenticated user' })
  async getProfiles(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getSubProfiles(user.id);
  }

  @Post('profiles')
  @ApiOperation({ summary: 'Create a new family sub-profile' })
  async createProfile(@CurrentUser() user: AuthenticatedUser, @Body() body: any) {
    return this.authService.createSubProfile(user.id, body);
  }

  @Get('devices')
  @ApiOperation({ summary: 'List active devices for authenticated user' })
  async getDevices(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getUserDevices(user.id);
  }

  @Delete('devices/:deviceId')
  @ApiOperation({ summary: 'Revoke a user device session' })
  async revokeDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deviceId') deviceId: string,
  ) {
    return this.authService.revokeUserDevice(user.id, deviceId);
  }
}
