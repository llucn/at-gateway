import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { CallRecord } from '../../entities/call-record.entity';
import { ModemService } from '../modem/modem.service';

@Injectable()
export class CallsService {
  constructor(
    @InjectRepository(CallRecord)
    private callRepo: Repository<CallRecord>,
    private modemService: ModemService,
    private eventEmitter: EventEmitter2,
  ) {}

  async makeCall(phoneNumber: string, ttsMessage?: string) {
    const manager = this.modemService.getCallManager();
    if (!manager) {
      throw new Error('Modem not connected');
    }

    const call = this.callRepo.create({
      direction: 'outbound',
      phoneNumber,
      status: 'initiating',
      startedAt: new Date(),
    });

    await this.callRepo.save(call);

    try {
      await manager.dial(phoneNumber);
      call.status = 'active';
      call.answeredAt = new Date();
      await this.callRepo.save(call);

      // TODO: Play TTS if provided
      
      this.eventEmitter.emit('call.started', call);
      return call;
    } catch (error: any) {
      call.status = 'failed';
      call.failureReason = error.message;
      call.endedAt = new Date();
      await this.callRepo.save(call);
      throw error;
    }
  }

  async hangup(id: string) {
    const manager = this.modemService.getCallManager();
    if (!manager) {
      throw new Error('Modem not connected');
    }

    await manager.hangup();

    const call = await this.callRepo.findOne({ where: { id } });
    if (call) {
      call.status = 'ended';
      call.endedAt = new Date();
      if (call.answeredAt) {
        call.duration = Math.floor((call.endedAt.getTime() - call.answeredAt.getTime()) / 1000);
      }
      await this.callRepo.save(call);
    }

    return { success: true };
  }

  @OnEvent('call.incoming')
  async handleIncomingCall(data: any) {
    const call = this.callRepo.create({
      direction: 'inbound',
      phoneNumber: data.phoneNumber || 'unknown',
      status: 'ringing',
      startedAt: new Date(),
    });

    await this.callRepo.save(call);
    this.eventEmitter.emit('webhook.call.incoming', call);
  }

  @OnEvent('call.ended')
  async handleCallEnded() {
    // Update most recent active call
    const activeCalls = await this.callRepo.find({
      where: { status: 'active' },
      order: { startedAt: 'DESC' },
      take: 1,
    });

    if (activeCalls.length > 0) {
      const call = activeCalls[0]!;
      call.status = 'ended';
      call.endedAt = new Date();
      if (call.answeredAt) {
        call.duration = Math.floor((call.endedAt.getTime() - call.answeredAt.getTime()) / 1000);
      }
      await this.callRepo.save(call);
      this.eventEmitter.emit('webhook.call.ended', call);
    }
  }

  async findAll(query: any) {
    const { page = 1, limit = 20, direction, status, phoneNumber } = query;
    const where: any = {};
    if (direction) where.direction = direction;
    if (status) where.status = status;
    if (phoneNumber) where.phoneNumber = phoneNumber;

    const [data, total] = await this.callRepo.findAndCount({
      where,
      order: { startedAt: 'DESC' },
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
    const call = await this.callRepo.findOne({ where: { id } });
    if (!call) {
      throw new NotFoundException('Call not found');
    }
    return call;
  }
}
