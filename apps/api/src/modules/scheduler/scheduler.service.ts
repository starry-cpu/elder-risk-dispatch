import { Injectable } from '@nestjs/common';

@Injectable()
export class SchedulerService {
  async scanMissedCheckIns() {
    throw new Error('Not implemented');
  }

  async escalateTimeouts() {
    throw new Error('Not implemented');
  }

  async getRuns(_query: any) {
    throw new Error('Not implemented');
  }
}
