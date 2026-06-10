# Epic 2 数据采集 — 设计文档

> 日期：2026-06-10  
> 状态：设计已确认，待实施  
> 对应 GitHub Issue：[#8](https://github.com/starry-cpu/elder-risk-dispatch/issues/8)  
> 开发计划：§2 阶段 2 — 数据采集（报平安 / 巡访 / 设备）

---

## 1. 背景与目标

打通前端用户到后端的数据采集与归档，包括报平安、线下巡访、健康/设备上报，支持多方式与异常检测，为风险判定（Epic 3）提供一手数据。

**依赖：** Epic 0（脚手架）+ Epic 1（鉴权/用户/老人档案）— 已完成。

**依赖模块：**
- `AuthModule` — JWT 鉴权、RBAC 守卫
- `UsersModule` — 用户角色/片区
- `EldersModule` — 老人档案查询
- `FieldEncryptionService` — 已存在，本次不新增加密字段

---

## 2. 模块架构（方案 A — 独立模块）

```
modules/
├── auth/              # ✓ 已有
├── users/             # ✓ 已有
├── elders/            # ✓ 已有
├── health/            # ✓ 已有
├── uploads/           # ✨ 新增 — MinIO 预签名 URL + 文件验证
├── check-ins/         # ✨ 新增 — 报平安
├── visits/            # ✨ 新增 — 巡访记录
└── devices/           # ✨ 新增 — 设备数据上报 + HMAC 校验
```

---

## 3. 模块详细设计

### 3.1 UploadsModule

**职责：** 生成 MinIO 预签名上传 URL，验证文件类型白名单。

```
uploads/
├── uploads.module.ts
├── uploads.service.ts
├── uploads.service.spec.ts
├── uploads.controller.ts
└── dto/
    └── presigned-url.dto.ts
```

**UploadService 接口：**
- `generatePresignedUrl(fileName, contentType, folder)` → `{ url, key, expiresIn }`
- `validateContentType(contentType, allowed)` → `boolean`

**S3 配置：** 使用 `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`，兼容 MinIO。通过 `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET` 环境变量配置。

**文件类型白名单：**
| 目录 | 允许类型 |
|------|---------|
| `checkins/` | `audio/mp3`, `audio/wav`, `audio/m4a` |
| `visits/` | `image/jpeg`, `image/png`, `image/webp`, `image/heic` |

---

### 3.2 CheckInsModule

**职责：** 报平安提交与查询。支持四种报到方式，代填权限校验。

```
check-ins/
├── check-ins.module.ts
├── check-ins.service.ts
├── check-ins.service.spec.ts
├── check-ins.controller.ts
└── dto/
    ├── create-check-in.dto.ts
    └── query-check-in.dto.ts
```

**CheckInService.create() 校验流程：**
1. Elder 存在校验 → 404
2. 权限校验：FAMILY 需 ElderFamilyLink 绑定 / GRID_WORKER 需同片区 → 403
3. 条件必填：VOICE → voiceUrl 必填 / TEXT → content 必填
4. voiceUrl MIME 白名单校验
5. PROXY 模式记录 userId（谁代填）

**API：**
| 方法 | 路径 | 权限 |
|------|------|------|
| `POST` | `/check-ins` | FAMILY / GRID_WORKER |
| `GET` | `/elders/:id/check-ins` | 同片区可见 |

**CreateCheckInDto：**
```typescript
{
  elderId: string;           // 关联老人
  method: 'ONE_TAP' | 'VOICE' | 'TEXT' | 'PROXY';
  content?: string;          // TEXT 模式文本 / PROXY 备注
  voiceUrl?: string;         // VOICE 模式语音文件 URL
}
```

---

### 3.3 VisitsModule

**职责：** 线下巡访记录。仅网格员可提交，含定位和照片。

```
visits/
├── visits.module.ts
├── visits.service.ts
├── visits.service.spec.ts
├── visits.controller.ts
└── dto/
    ├── create-visit.dto.ts
    └── query-visit.dto.ts
```

**VisitService.create() 校验流程：**
1. Elder 存在校验 → 404
2. 提交人必须是 GRID_WORKER 且同片区 → 403
3. observation 必填（≤1000 字符）
4. longitude/latitude 范围校验：73°E-135°E, 18°N-54°N
5. photos 每项为合法 URL

**API：**
| 方法 | 路径 | 权限 |
|------|------|------|
| `POST` | `/visits` | GRID_WORKER |
| `GET` | `/visits?elderId=&from=&to=` | 同片区可见 |

**CreateVisitDto：**
```typescript
{
  elderId: string;
  observation: string;         // 观察记录（必填，≤1000字符）
  photos?: string[];           // 预签名 URL 数组
  note?: string;               // 备注
  longitude?: number;          // 经度 (73-135)
  latitude?: number;           // 纬度 (18-54)
  visitTime?: string;          // 巡访时间，默认 now
}
```

---

### 3.4 DevicesModule

**职责：** 设备/网关数据上报，HMAC 签名校验，告警数据落库。

```
devices/
├── devices.module.ts
├── devices.service.ts
├── devices.service.spec.ts
├── devices.controller.ts
├── hmac/
│   ├── hmac.service.ts
│   ├── hmac.service.spec.ts
│   └── hmac.guard.ts          # HMAC 校验守卫
└── dto/
    ├── device-data.dto.ts
    └── query-device.dto.ts
```

**HMAC 校验策略：**
- 算法：HMAC-SHA256
- 密钥：单一共享密钥（`DEVICE_HMAC_SECRET` 环境变量）
- 签名内容：`timestamp + "." + JSON.stringify(payload)` （规范化排序）
- 防重放：timestamp ±5 分钟窗口
- **预留扩展：** HmacService 接口 `verify(deviceId, payload, signature)` — `deviceId` 参数当前未使用，为每设备独立密钥预留

**DeviceService.ingest() 流程：**
1. HMAC 守卫校验签名 → 401
2. Elder 存在校验 → 404
3. deviceType/metricType 必填校验 → 400
4. 落库 DeviceData
5. alarm=true 时，预留 `@Inject('DEVICE_ALARM_QUEUE')` 注入点（Epic 5 接入 BullMQ）

**API：**
| 方法 | 路径 | 权限 |
|------|------|------|
| `POST` | `/devices/data` | HMAC 签名校验（无需 JWT） |
| `GET` | `/elders/:id/devices` | 同片区可见 |

**DeviceDataDto：**
```typescript
{
  deviceId: string;            // 设备标识
  elderId: string;             // 关联老人
  deviceType: string;          // BLOOD_PRESSURE | HEART_RATE | FALL_DETECTOR | SMOKE | WATER
  metricType: string;
  value?: string;              // 读数
  alarm: boolean;              // 是否告警
  timestamp: number;           // Unix 毫秒时间戳（用于 HMAC 签名）
}
```

---

## 4. 数据归档与检索

Epic 2 issue 提到"数据归档和检索接口（老人为中心聚合）"。

**实现方式：** 不新增独立聚合模块，而是利用已有 `GET /elders/:id/risk-profile` 接口（Epic 1 已预留），本次扩建该接口：

```typescript
// 扩建后的 ElderRiskProfile
{
  elder: Elder;
  contacts: EmergencyContact[];
  recentCheckIns: CheckIn[];       // ✨ 新增：最近 7 天报平安记录
  recentVisits: VisitRecord[];     // ✨ 新增：最近 30 天巡访记录
  recentDeviceAlarms: DeviceData[];// ✨ 新增：最近告警设备数据
  riskEvents: RiskEvent[];         // 已有（暂为空）
  summary: {
    checkInStreak: number;         // 连续报平安天数
    missedToday: boolean;          // 今日是否未报平安
    activeAlarms: number;          // 活跃告警数
  };
}
```

---

## 5. TDD 测试策略

### 5.1 测试文件清单

| 模块 | 单元测试文件 | E2E 测试文件 |
|------|-------------|-------------|
| Uploads | `uploads.service.spec.ts` | — |
| CheckIns | `check-ins.service.spec.ts` + `check-ins.controller.spec.ts` | `test/check-ins.e2e-spec.ts` |
| Visits | `visits.service.spec.ts` | `test/visits.e2e-spec.ts` |
| Devices | `devices.service.spec.ts` + `hmac.service.spec.ts` | `test/devices.e2e-spec.ts` |

### 5.2 关键测试用例

**UploadsService (≥5 tests):**
- ✅ 生成预签名 URL（合法参数）
- ✅ checkins 音频白名单通过
- ✅ visits 图片白名单通过
- ❌ 非白名单 content-type 拒绝
- ❌ 空 fileName 拒绝

**CheckInsService (≥12 tests):**
- ✅ ONE_TAP 一键报平安成功
- ✅ VOICE 含 voiceUrl 提交成功
- ✅ TEXT 含 content 提交成功
- ✅ PROXY FAMILY 代填（有 ElderFamilyLink 绑定）
- ✅ PROXY GRID_WORKER 代填（同片区）
- ❌ FAMILY 无绑定关系 → 403
- ❌ 跨片区 GRID_WORKER → 403
- ❌ Elder 不存在 → 404
- ❌ VOICE 无 voiceUrl → 400
- ❌ TEXT 无 content → 400
- ❌ voiceUrl 非音频类型 → 400
- ✅ findCheckIns(分页，同片区可见)

**VisitsService (≥8 tests):**
- ✅ GRID_WORKER 同片区提交巡访
- ✅ photos 数组正确保存
- ❌ 非 GRID_WORKER → 403
- ❌ 跨片区 → 403
- ❌ observation 为空 → 400
- ❌ 坐标超出中国范围 → 400
- ✅ 按时间范围查询
- ✅ 按 elderId 查询

**HmacService (≥10 tests):**
- ✅ 签名生成确定性验证
- ✅ 签名校验通过
- ❌ 签名修改后校验失败
- ❌ 时间戳过期 → 401
- ❌ 未来时间戳 → 401
- ❌ 签名头缺失 → 401
- ✅ timestamp 边界（±5分钟）通过
- ✅ payload JSON key 顺序不同但签名一致（规范化）
- ✅ 不同 payload 产生不同签名
- ✅ 不同密钥产生不同签名

**DevicesService (≥5 tests):**
- ✅ 正常设备数据落库
- ✅ alarm=true 告警数据落库
- ❌ Elder 不存在 → 404
- ❌ 缺少 deviceType → 400
- ✅ 分页查询设备数据

### 5.3 覆盖率门禁

- 整体 ≥ 80%
- `hmac.service.ts` ≥ 95%（安全关键路径）
- `check-ins.service.ts` ≥ 90%

---

## 6. 依赖与环境变量

### 新增环境变量

```bash
# 已有
DATABASE_URL=postgresql://app:app@localhost:5432/care
JWT_SECRET=change_me
FIELD_ENCRYPTION_KEY=base64_32_bytes_key
WECHAT_APPID=
WECHAT_SECRET=

# Epic 2 新增
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=care

DEVICE_HMAC_SECRET=shared-hmac-secret-for-devices
```

### 新增 npm 依赖

```json
{
  "@aws-sdk/client-s3": "^3.x",
  "@aws-sdk/s3-request-presigner": "^3.x"
}
```

---

## 7. 合规与安全

1. CheckIn/Visit 不暴露老人身份证、电话等加密字段
2. voiceUrl / photos 仅存储 S3 key，前端通过预签名 URL 访问（15 分钟过期）
3. HMAC 密钥从环境变量读取，不硬编码
4. 设备上报不依赖 JWT（IoT 设备无浏览器环境），签名防篡改 + 时间戳防重放
5. 片区隔离策略与 Epic 1 保持一致

---

## 8. 提交计划

按 TDD 原则，每模块独立分支提交：

| 步骤 | 提交 | 内容 |
|------|------|------|
| 1 | `feat: add UploadsModule with presigned URL and file validation` | UploadsModule + tests |
| 2 | `feat: add CheckInsModule with multi-method check-in and proxy support` | CheckInsModule + tests |
| 3 | `feat: add VisitsModule with location validation and photo support` | VisitsModule + tests |
| 4 | `feat: add DevicesModule with HMAC verification and alarm ingestion` | DevicesModule + HMAC + tests |
| 5 | `feat: expand Elder risk-profile with data aggregation endpoints` | 扩建 risk-profile + E2E |
| 6 | `chore: update .env.example and README with Epic 2 configuration` | 文档/配置更新 |

---

## 9. Definition of Done

- [ ] 4 个新模块（uploads/check-ins/visits/devices）全部实现
- [ ] 所有单元测试 + E2E 测试通过（≥50 tests）
- [ ] `pnpm lint` + `pnpm test` + `pnpm test:e2e` + `pnpm build` 全绿
- [ ] 覆盖率 ≥ 80%，hmac.service ≥ 95%
- [ ] 敏感字段不泄露（片区隔离、字段加密）
- [ ] HMAC 正确签名可过，篡改/过期/重放拒绝
- [ ] Elder risk-profile 聚合扩建完成
- [ ] Conventional Commits + PR 描述含变更点与测试说明
