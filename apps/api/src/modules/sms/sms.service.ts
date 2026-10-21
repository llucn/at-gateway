import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { SmsMessage } from '../../entities/sms-message.entity';
import { ModemService } from '../modem/modem.service';

@Injectable()
export class SmsService {
  constructor(
    @InjectRepository(SmsMessage)
    private smsRepo: Repository<SmsMessage>,
    private modemService: ModemService,
    private eventEmitter: EventEmitter2,
  ) {}

  async sendSms(phoneNumber: string, content: string) {
    const manager = this.modemService.getSmsManager();
    if (!manager) {
      throw new Error('Modem not connected');
    }

    const message = this.smsRepo.create({
      direction: 'outbound',
      phoneNumber,
      content,
      status: 'pending',
      encoding: 'gsm7',
    });

    await this.smsRepo.save(message);

    try {
      await manager.sendSms({ phoneNumber, text: content });
      message.status = 'sent';
      message.deliveredAt = new Date();
      await this.smsRepo.save(message);

      this.eventEmitter.emit('sms.sent', message);
      return message;
    } catch (error: any) {
      message.status = 'failed';
      message.failureReason = error.message;
      await this.smsRepo.save(message);
      throw error;
    }
  }

  @OnEvent('sms.received')
  async handleSmsReceived(sms: any) {
    const message = this.smsRepo.create({
      direction: 'inbound',
      phoneNumber: sms.phoneNumber,
      content: sms.text,
      status: 'received',
      encoding: sms.encoding,
    });

    await this.smsRepo.save(message);
    this.eventEmitter.emit('webhook.sms.received', message);
  }

  async findAll(query: any) {
    const { page = 1, limit = 20, direction, status, phoneNumber } = query;
    const where: any = {};
    if (direction) where.direction = direction;
    if (status) where.status = status;
    if (phoneNumber) where.phoneNumber = phoneNumber;

    const [data, total] = await this.smsRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const message = await this.smsRepo.findOne({ where: { id } });
    if (!message) {
      throw new NotFoundException('SMS not found');
    }
    return message;
  }
}
