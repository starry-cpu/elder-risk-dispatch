import { Injectable } from '@nestjs/common';

@Injectable()
export class EldersService {
  async create(dto: any, requester: any): Promise<any> {
    throw new Error('Not implemented');
  }

  async findAll(query: any): Promise<any> {
    throw new Error('Not implemented');
  }

  async findById(id: string, requester: any): Promise<any> {
    throw new Error('Not implemented');
  }

  async update(id: string, dto: any): Promise<any> {
    throw new Error('Not implemented');
  }

  async addContact(elderId: string, dto: any): Promise<any> {
    throw new Error('Not implemented');
  }

  async getContacts(elderId: string): Promise<any> {
    throw new Error('Not implemented');
  }

  async getRiskProfile(elderId: string): Promise<any> {
    throw new Error('Not implemented');
  }

  async linkFamily(elderId: string, userId: string, relation: string): Promise<any> {
    throw new Error('Not implemented');
  }
}
