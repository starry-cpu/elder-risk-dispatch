import { Injectable } from '@nestjs/common';

export interface LoginResult {
  token: string;
  user: {
    id: string;
    name: string;
    phone?: string;
    role: string;
    district?: string;
    openid?: string;
    skills?: string[];
    dutyStatus?: string;
    createdAt?: Date;
  };
}

@Injectable()
export class AuthService {
  async adminLogin(dto: { phone: string; password: string }): Promise<LoginResult> {
    throw new Error('Not implemented');
  }

  async wechatLogin(openid: string, nickname?: string): Promise<LoginResult> {
    throw new Error('Not implemented');
  }

  async validateUser(userId: string): Promise<{ sub: string; role: string; district?: string }> {
    throw new Error('Not implemented');
  }
}
