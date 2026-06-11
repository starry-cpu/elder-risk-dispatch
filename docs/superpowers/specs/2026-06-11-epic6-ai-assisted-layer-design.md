# Epic 6 — AI 辅助层集成设计：异常文本触发风险引擎

> 日期：2026-06-11 | 分支：`epic-6/ai-assisted-layer` | Issue：[#4](https://github.com/starry-cpu/elder-risk-dispatch/issues/4)

## 1. 背景

Epic 6 的 AI 辅助层基础设施（AiClient 封装、classify/summarize 接口、合规拦截、AiInferenceLog 落库）已实现完毕。但 AI 分类能力尚未与风险引擎连通——当老人通过 CheckIn 上报文本/语音内容时，系统不会自动分析内容是否异常，也就无法以 `RiskSource.ABNORMAL_TEXT` 触发风险事件。

本设计聚焦于**最后一块拼图**：将 AI 分类能力接入 CheckIn → Risk 流程，实现"报平安文本自动异常检测 → 风险事件生成"的闭环。

## 2. 目标范围

- **In scope**：CheckIn 创建时自动调用 AI classify，检测异常文本并触发 RiskEvent
- **Out of scope**：语音转文字（语音文件直接跳过，不做 STT）、AI summarize 流程变更、前端变更

## 3. 架构决策

### 3.1 模块依赖

CheckInsModule 直接导入 AiModule 和 RiskModule，注入对应 Service：

```
CheckInsModule
  ├── imports: [AiModule, RiskModule]
  └── CheckInsService
        ├── AiService.classify(text)    → 文本异常分类
        └── RiskService.evaluateAndCreateEvent({ abnormalText: true })
                                       → 生成风险事件
```

**无循环依赖**：依赖方向为 CheckIn → Ai、CheckIn → Risk，单向无环。NestJS 的模块系统原生支持同一 Module 被多处 import（AiModule/RiskModule 已在 AppModule 中 import，再被 CheckInsModule import 不会导致重复实例化）。

### 3.2 同步 vs 异步

采用**同步 fire-and-forget** 模式：CheckIn 写入数据库后立即返回 201，AI 分析与风险事件创建在 `create()` 方法末尾以非阻塞方式执行（不 await 其 Promise，但内部 try-catch 确保异常不冒泡）。

理由：
- 不引入额外依赖（EventEmitter / BullMQ 队列均可实现，但对本场景过度设计）
- CheckIn 创建延迟不受 AI 调用影响
- 即使 AI 调用失败，Scheduler 的 `missed-checkin-scan` 定时任务仍会兜底检测

### 3.3 为什么不在 CheckInController 层做？

业务逻辑归属 Service 层，Controller 仅做路由和参数校验。AI 分析和风险判定是核心业务逻辑，放在 Service 层便于单测、符合既有代码风格。

## 4. 异常判定规则

`AiService` 新增导出纯函数 `isAbnormalTextResult()`，输入 AI classify 结果，返回 boolean：

| 条件 | 判定 | 权重（RiskRule） |
|------|------|------------------|
| AI 返回 `type === 'HEALTH'` 且 `confidence >= 0.7` | **异常** | +30（`abnormalText` 规则） |
| AI 返回 `needsHumanReview === true`（即 `confidence < 0.6`）| **异常** | +30 |
| 其他（正常生活类请求、高置信度非健康类）| 正常 | 0 |

> 叠加效应：30 分（异常文本）+ 15 分（高龄+慢病叠加）= 45 分 → MEDIUM；30 分 + 40 分（其他风险）= 70 → HIGH。

## 5. 数据流

```
POST /api/v1/check-ins
  Body: { elderId, method: TEXT, content: "我头晕，需要帮助" }

  CheckInsService.create()
    ├── validate elderId, permissions, method/content consistency
    ├── prisma.checkIn.create({ ... })        ← 写入成功，返回 201
    │
    └── [不阻塞响应]
        try {
          result = AiService.classify(content)
          if (isAbnormalTextResult(result)) {
            RiskService.evaluateAndCreateEvent({
              elderId,
              abnormalText: true,
              // age, hasChronicDisease, recentHighRisk 由 RiskService 自动计算
            })
            // → RiskEvent { level, source: ABNORMAL_TEXT, reason: "异常文本,..." }
          }
        } catch (err) {
          // 静默降级：AI 不可用时不影响 CheckIn
          // 日志记录便于运维排查
        }
```

## 6. 容错与兜底

| 场景 | 行为 |
|------|------|
| AI API 不可用 | `AiClient.chat()` 重试 3 次后抛错 → 被 catch 吞掉 → CheckIn 创建成功，无 RiskEvent |
| AI 返回非 JSON | `AiService.classify()` fallback 为 `{ type: 'LIFE', confidence: 0.3 }` → 不触发异常 |
| 合规拦截命中 | `validateNoMedicalAdvice()` 抛错 → 被 catch 吞掉 → CheckIn 创建成功 |
| 风险评分为 0 | `RiskService.evaluateAndCreateEvent()` 返回 null → 无 RiskEvent 创建 |
| CheckIn 方法为 ONE_TAP 或 VOICE（无文本）| 直接跳过 AI 分析 |
| 定时任务兜底 | `missed-checkin-scan` 每小时扫描未报平安老人 → 独立生成 MISSED_CHECKIN 来源的 RiskEvent |

## 7. 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `modules/ai/ai.service.ts` | 修改 | 新增导出纯函数 `isAbnormalTextResult()` |
| `modules/ai/ai.service.spec.ts` | 修改 | 补充 `isAbnormalTextResult` 边界测试 |
| `modules/check-ins/check-ins.module.ts` | 修改 | imports 增加 `AiModule`, `RiskModule` |
| `modules/check-ins/check-ins.service.ts` | 修改 | 注入 `AiService`, `RiskService`；`create()` 末尾追加异常检测逻辑 |
| `modules/check-ins/check-ins.service.spec.ts` | 修改 | 补充 4 个 AI 集成场景单测 |
| `modules/check-ins/check-ins.e2e-spec.ts` | 修改 | 补充 ABNORMAL_TEXT 全链路 E2E（可选，视现有 E2E 结构而定）|

## 8. 测试策略

### 8.1 单元测试 (`check-ins.service.spec.ts`)

Mock AiService + RiskService，验证：

| # | 场景 | 输入 | 期望 |
|---|------|------|------|
| 1 | 正常文本，不触发风险 | `content: "需要买米"`, AI 返回 `{ type: ERRAND, confidence: 0.9 }` | `riskService.evaluateAndCreateEvent` 不被调用 |
| 2 | HEALTH 高置信度 → 触发 | AI 返回 `{ type: HEALTH, confidence: 0.85 }` | `evaluateAndCreateEvent` 被调用 1 次，含 `abnormalText: true` |
| 3 | 低置信度 → 触发 | AI 返回 `{ type: LIFE, confidence: 0.45 }` | `evaluateAndCreateEvent` 被调用 1 次 |
| 4 | AI 抛错 → 静默降级 | `aiService.classify.mockRejectedValue(...)` | CheckIn 正常创建，`evaluateAndCreateEvent` 不被调用，不抛错 |
| 5 | ONE_TAP 方法无内容 → 跳过 | `method: ONE_TAP, content: undefined` | `aiService.classify` 不被调用 |

### 8.2 纯函数测试 (`ai.service.spec.ts`)

`isAbnormalTextResult()` 独立测试：HEALTH+高置信度、HEALTH+低置信度、非 HEALTH+高置信度、边界值 confidence=0.6/0.7。

### 8.3 AI mock 合规

延续既有约定：所有 AI 调用一律 mock（`jest.mock`），不在 CI 打真实 API。真实的 DeepSeek 连通性通过 `*.contract.spec.ts` 手动验证。

## 9. 验收标准

- [ ] `POST /check-ins` 含异常文本内容时，自动生成 `RiskEvent`（`source: ABNORMAL_TEXT`）
- [ ] 正常文本（生活类）不生成风险事件
- [ ] AI 不可用时不阻塞 CheckIn 创建
- [ ] 合规拦截输出（含医疗词汇）不生成风险事件
- [ ] 所有新增测试通过，覆盖率达标（risk 模块 ≥ 95%）
- [ ] CI 不打真实 AI API
