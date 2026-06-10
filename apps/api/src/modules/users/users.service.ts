import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  async create(dto: any, requester: any): Promise<any> { throw new Error('Not implemented'); }
  async findAll(query: any): Promise<any> { throw new Error('Not implemented'); }
  async findById(id: string, requester: any): Promise<any> { throw new Error('Not implemented'); }
  async update(id: string, dto: any): Promise<any> { throw new Error('Not implemented'); }
  async updateDutyStatus(id: string, status: string, requester: any): Promise<any> { throw new Error('Not implemented'); }
}
