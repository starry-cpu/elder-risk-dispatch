import { PrismaClient, RiskLevel, Role } from '@prisma/client';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Replicates FieldEncryptionService.encrypt() for standalone seed usage */
function encryptField(plaintext: string): string {
  const keyBase64 = process.env.FIELD_ENCRYPTION_KEY;
  if (!keyBase64) {
    throw new Error('FIELD_ENCRYPTION_KEY environment variable is required');
  }
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error(`FIELD_ENCRYPTION_KEY must be 32 bytes, got ${key.length}`);
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function hashPhone(phone: string): string {
  return crypto.createHash('sha256').update(phone).digest('hex');
}

async function main() {
  console.log('Seeding default users...');

  const defaultAdminPhone = '13800138000';
  const encryptedPhone = encryptField(defaultAdminPhone);
  const phoneHash = hashPhone(defaultAdminPhone);

  const existingAdmin = await prisma.user.findUnique({ where: { phoneHash } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        phone: encryptedPhone,
        phoneHash,
        name: '系统管理员',
        role: Role.ADMIN,
        passwordHash: await bcrypt.hash('admin123', 10),
        district: '东区',
        skills: ['系统管理'],
      },
    });
    console.log(`  Created admin user: ${defaultAdminPhone} / admin123`);
  } else {
    console.log(`  Admin user already exists: ${defaultAdminPhone}`);
  }

  console.log('Seeding risk rules...');

  const rules = [
    {
      name: '连续未报平安',
      condition: {
        description: '24小时内无报平安记录',
        field: 'hoursSinceLastCheckIn',
        operator: 'gte',
        value: 24,
      },
      weight: 40,
      level: RiskLevel.MEDIUM,
      version: 1,
      enabled: true,
    },
    {
      name: '设备跌倒报警',
      condition: {
        description: '设备检测到跌倒并触发报警',
        field: 'metricType',
        operator: 'eq',
        value: 'FALL',
        requireAlarm: true,
      },
      weight: 60,
      level: RiskLevel.HIGH,
      version: 1,
      enabled: true,
    },
    {
      name: '烟感/水浸报警',
      condition: {
        description: '烟感或水浸传感器触发报警',
        field: 'metricType',
        operator: 'in',
        value: ['SMOKE', 'WATER'],
        requireAlarm: true,
      },
      weight: 50,
      level: RiskLevel.HIGH,
      version: 1,
      enabled: true,
    },
    {
      name: '异常文本',
      condition: {
        description: 'AI分类识别到求助或异常表达',
        field: 'aiClassification',
        operator: 'in',
        value: ['求助', '异常'],
      },
      weight: 30,
      level: RiskLevel.MEDIUM,
      version: 1,
      enabled: true,
    },
    {
      name: '高龄+慢病叠加',
      condition: {
        description: '年龄≥80且带有慢性病标签',
        field: 'age',
        operator: 'gte',
        value: 80,
        requireChronicDisease: true,
      },
      weight: 15,
      level: RiskLevel.MEDIUM,
      version: 1,
      enabled: true,
    },
    {
      name: '近7天高风险史',
      condition: {
        description: '近7天内有HIGH级别风险事件记录',
        field: 'recentHighRisk',
        operator: 'eq',
        value: true,
        lookbackDays: 7,
      },
      weight: 10,
      level: RiskLevel.MEDIUM,
      version: 1,
      enabled: true,
    },
  ];

  for (const rule of rules) {
    const existing = await prisma.riskRule.findFirst({
      where: { name: rule.name, version: rule.version },
    });
    if (!existing) {
      await prisma.riskRule.create({ data: rule });
      console.log(`  Created rule: ${rule.name}`);
    } else {
      console.log(`  Skipped (already exists): ${rule.name}`);
    }
  }

  console.log('Seeding miniapp family + elder + workorder...');

  // 家属账号：稳定的测试 openid，便于微信登录 jscode2session 命中
  const familyOpenid = 'test-family-openid-001';
  const familyUser =
    (await prisma.user.findUnique({ where: { openid: familyOpenid } })) ??
    (await prisma.user.create({
      data: {
        openid: familyOpenid,
        name: '测试家属',
        role: Role.FAMILY,
      },
    }));
  console.log(`  Family user: ${familyUser.id} (openid=${familyOpenid})`);

  // worker 账号：作为工单 createdById（WorkOrder 必填）
  const workerPhone = '13900139001';
  const workerHash = hashPhone(workerPhone);
  const workerUser =
    (await prisma.user.findUnique({ where: { phoneHash: workerHash } })) ??
    (await prisma.user.create({
      data: {
        phone: encryptField(workerPhone),
        phoneHash: workerHash,
        name: '测试网格员',
        role: Role.GRID_WORKER,
        district: '测试区',
        dutyStatus: 'ON_DUTY',
        skills: ['LIFE'],
      },
    }));
  console.log(`  Worker user: ${workerUser.id} (phone=${workerPhone})`);

  // 两位老人（便于验证老人切换条）
  const elderNames = ['测试老人甲', '测试老人乙'];
  const elders: { id: string; name: string }[] = [];
  for (const name of elderNames) {
    const existing = await prisma.elder.findFirst({ where: { name } });
    const elder =
      existing ??
      (await prisma.elder.create({
        data: {
          name,
          gender: 'M',
          district: '测试区',
          serviceLevel: 'HIGH',
          livingStatus: '独居',
        },
      }));
    elders.push({ id: elder.id, name });
    console.log(`  Elder: ${elder.id} (${name})`);
  }

  // 关联：家属 ↔ 每位老人（@@unique([elderId, userId]) 幂等）
  for (const elder of elders) {
    const linkExists = await prisma.elderFamilyLink.findFirst({
      where: { elderId: elder.id, userId: familyUser.id },
    });
    if (!linkExists) {
      await prisma.elderFamilyLink.create({
        data: { elderId: elder.id, userId: familyUser.id, relation: '子女' },
      });
      console.log(`  Linked ${elder.name} ↔ family`);
    }
  }

  // 给第一位老人一条工单（ASSIGNED 便于 order-progress 验证）
  const workOrderType = 'LIFE';
  const woExists = await prisma.workOrder.findFirst({
    where: { elderId: elders[0].id, type: workOrderType },
  });
  if (!woExists) {
    await prisma.workOrder.create({
      data: {
        elderId: elders[0].id,
        type: workOrderType,
        level: RiskLevel.MEDIUM,
        status: 'ASSIGNED',
        createdById: workerUser.id,
        dispatchReason: '联调测试工单',
      },
    });
    console.log(`  WorkOrder (ASSIGNED) for ${elders[0].name}`);
  }

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
