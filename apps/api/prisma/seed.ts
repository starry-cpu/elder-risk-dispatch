import { PrismaClient, RiskLevel } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
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
