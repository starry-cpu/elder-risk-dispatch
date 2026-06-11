import { Test, TestingModule } from '@nestjs/testing';
import { DashboardGateway } from './dashboard.gateway';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

describe('DashboardGateway', () => {
  let gateway: DashboardGateway;
  let mockServer: Partial<Server>;

  beforeEach(async () => {
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardGateway,
        {
          provide: JwtService,
          useValue: { verify: jest.fn().mockReturnValue({ sub: 'u-1', role: 'ADMIN', district: '朝阳区' }) },
        },
      ],
    }).compile();

    gateway = module.get<DashboardGateway>(DashboardGateway);
    (gateway as unknown as Record<string, unknown>).server = mockServer;
  });

  describe('handleConnection', () => {
    it('有效 token 时应加入房间', () => {
      const client = {
        handshake: { auth: { token: 'valid-jwt' } },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as unknown as Socket;

      gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith('user:u-1');
      expect(client.join).toHaveBeenCalledWith('role:ADMIN');
      expect(client.join).toHaveBeenCalledWith('district:朝阳区');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('无 token 时应断开连接', () => {
      const client = {
        handshake: { auth: {} },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as unknown as Socket;

      gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('无效 token 时应断开连接', () => {
      const jwtService = (gateway as unknown as Record<string, unknown>).jwtService as { verify: jest.Mock };
      jwtService.verify.mockImplementationOnce(() => { throw new Error('invalid'); });

      const client = {
        handshake: { auth: { token: 'bad-token' } },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as unknown as Socket;

      gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('emitToUser', () => {
    it('应向 user:{userId} 房间发送事件', () => {
      gateway.emitToUser('u-1', 'notification:new', { id: 'n-1' });

      expect(mockServer.to).toHaveBeenCalledWith('user:u-1');
      expect(mockServer.emit).toHaveBeenCalledWith('notification:new', { id: 'n-1' });
    });
  });

  describe('emitToRole', () => {
    it('应向 role:{role} 房间发送事件', () => {
      gateway.emitToRole('ADMIN', 'risk:alert', { level: 'HIGH' });

      expect(mockServer.to).toHaveBeenCalledWith('role:ADMIN');
      expect(mockServer.emit).toHaveBeenCalledWith('risk:alert', { level: 'HIGH' });
    });
  });

  describe('emitToDistrict', () => {
    it('应向 district:{district} 房间发送事件', () => {
      gateway.emitToDistrict('朝阳区', 'risk:alert', { level: 'MEDIUM' });

      expect(mockServer.to).toHaveBeenCalledWith('district:朝阳区');
      expect(mockServer.emit).toHaveBeenCalledWith('risk:alert', { level: 'MEDIUM' });
    });
  });
});
