import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../../users/entities/device.entity';

@Injectable()
export class UserDeviceService {
  private readonly logger = new Logger(UserDeviceService.name);

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
  ) {}

  async getUserDevices(userId: string): Promise<Device[]> {
    return this.deviceRepo.find({
      where: { userId },
      order: { lastSeen: 'DESC' },
    });
  }

  async revokeUserDevice(userId: string, deviceId: string): Promise<{ deviceId: string; revoked: boolean }> {
    await this.deviceRepo.delete({ userId, deviceId });
    return { deviceId, revoked: true };
  }

  async updateDeviceFcmToken(userId: string, body: any, ipAddress?: string): Promise<any> {
    const deviceId = body?.deviceId || body?.device_id || 'default-device';
    const fcmToken = body?.fcmToken || body?.fcm_token || body?.deviceToken || body?.device_token;

    let device = await this.deviceRepo.findOne({ where: { userId, deviceId } });
    if (!device) {
      device = this.deviceRepo.create({
        userId,
        deviceId,
        deviceName: body?.deviceName || body?.device_name || 'Mobile Device',
        platform: body?.platform || body?.os || 'ANDROID',
        fcmToken,
        ipAddress: ipAddress || null,
        lastSeen: new Date(),
      });
    } else {
      if (fcmToken) device.fcmToken = fcmToken;
      if (ipAddress) device.ipAddress = ipAddress;
      device.lastSeen = new Date();
    }

    await this.deviceRepo.save(device);
    return {
      success: true,
      deviceId,
      fcmRegistered: Boolean(fcmToken),
      updatedAt: device.lastSeen,
    };
  }
}

