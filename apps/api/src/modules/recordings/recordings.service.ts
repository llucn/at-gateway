import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recording } from '../../entities/recording.entity';

@Injectable()
export class RecordingsService {
  constructor(
    @InjectRepository(Recording)
    private recordingRepo: Repository<Recording>,
  ) {}

  async findAll(query: any) {
    const { page = 1, limit = 20 } = query;

    const [data, total] = await this.recordingRepo.findAndCount({
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
    const recording = await this.recordingRepo.findOne({ where: { id } });
    if (!recording) {
      throw new NotFoundException('Recording not found');
    }
    return recording;
  }
}
