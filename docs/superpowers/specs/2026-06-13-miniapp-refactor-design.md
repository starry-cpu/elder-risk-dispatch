# 微信小程序前端系统性重构 · 设计文档

- **日期**：2026-06-13
- **分支**：epic-8/frontend-three-platforms
- **范围**：apps/miniapp（uni-app + Vue3 + TS 微信小程序）+ apps/api（NestJS 后端）的最小必要改动
- **状态**：设计已与用户逐节确认，待生成实施计划

---

## 1. 背景与根因调查结论

### 1.1 现状

小程序分为三端：

- **工人端**（pagesWorker）：risk-tasks / work-order / visit-form / verification，已用 App* 组件 + BEM 样式重构过，能跑。
- **老人端**（pagesElder）：check-in / sos / order-progress，已重写但链路断裂。
- **首页/登录**（pages/index）：enterApp() 用 Promise.race + 8s timeout，体验脆弱。

### 1.2 根因调查（systematic-debugging Phase 1）

通读 apps/miniapp/src 全部源码 + apps/api/prisma/schema.prisma + 相关 controller/service 后，确认老人端目前**没有一条能跑通的路径**。表面是多个孤立 bug，实质是同一条断裂的「身份→老人→操作」链：

```
登录拿 token + user(role)
      │
      ▼  ❶ 缺口：没有任何地方写 elderId 到 storage
      │     └─ 根因：后端没有「查当前用户关联老人」的接口
      │        (elders.service.findAll 只按 district 过滤，FAMILY 的 district 通常为空)
      ▼
check-in/sos 读 uni.getStorageSync('elderId')  →  永远空
      │
      ├─❷ useCheckIn.validate() 因 elderId 空直接拦掉  →  ONE_TAP/TEXT 发不出
      └─❸ 就算绕过本地校验，check-ins.service.create 对 FAMILY 强制 familyLink 鉴权
            → 没建过 ElderFamilyLink 的用户 → 后端 403「无权限为此老人报平安」
      │
      ❹ 语音走假 voiceUrl = 'recorded_audio_xxx'（无扩展名）
            → 后端校验必须 .mp3/.wav/.m4a/.aac → 直接 400 拒掉
            → 且 upload.ts 用 http.post，后端实际是 GET /uploads/presigned-url，方法+参数都对不上
      │
      ❺ order-progress 没按 elderId 过滤
            → 而且就算加了 elderId，work-orders.findAll 对非 ADMIN 强制
              where.elder.district = requester.district，FAMILY 的 district 为 null → 查到空
      │
      ❻ auth.ts 里 isElder 判断 role === 'ELDER'，但 schema 的 Role 枚举里根本没 ELDER
            （wechatLogin 把所有微信用户 upsert 成 FAMILY）→ ELDER 分支是死代码
```

### 1.3 关键事实（数据模型依据）

- `schema.prisma` 的 `Role` 枚举：`GRID_WORKER / COMMUNITY_DOCTOR / PROPERTY / VOLUNTEER / ADMIN / FAMILY`。**没有 ELDER**。
- `wechatLogin` 把所有微信用户 upsert 成 `Role.FAMILY`（auth.service.ts:44）。
- `ElderFamilyLink` 是 User↔Elder 的多对多关联（schema.prisma:135-144，`@@unique([elderId, userId])`），一个家属可关联多个老人。
- `check-ins.service.create` 的 `authorizeAccess` 要求 FAMILY 必须有 familyLink 才能报平安（check-ins.service.ts:113-125）。
- `check-ins.service.create` 校验 voiceUrl 必须以 `.mp3/.wav/.m4a/.aac` 结尾（check-ins.service.ts:45-52）。
- `work-orders.findAll` 对非 ADMIN 强制 `where.elder = { district: requester.district ?? '' }`（work-orders.service.ts:182-186），FAMILY 的 district 为 null → 查到空。
- `uploads.controller` 的 presigned-url 实际是 `GET`（用 Query），但前端 `upload.ts` 用 `http.post`，方法 + 参数（缺 folder）都对不上。
- 小程序 `wx.uploadFile` 只支持 POST multipart，无法直接 PUT 到 MinIO 预签名 URL。

---

## 2. 目标与范围

### 2.1 目标

1. 打通「登录 → 角色识别 → 老人身份关联 → 业务操作」完整闭环。
2. 统一老人端 + 工人端的视觉与交互规范。
3. 修复 elderId 缺失、录音占位等遗留问题。
4. 确保微信开发者工具里能完整跑通三端主流程。

### 2.2 验收边界（本次「跑通」的定义）

- ① 启动 → 登录（jscode2session）→ 角色路由正确
- ② FAMILY：选老人 → 报平安（一键/文字）成功 → 求助录音上传成功 → 工单进度可见 → 未绑定有引导
- ③ WORKER/ADMIN：风险列表 → 复核、工单 → 接单/完成、巡访填报
- admin-web 管理后台**不在范围内**

### 2.3 明确不做的事（防范围蔓延）

- 不重写 worker 端页面实现（只回归验证）
- 不动 admin-web 管理后台
- 不做并发/弱网/自动重登等健壮性增强（超出现有验收边界）
- 不改后端 Role 枚举、不改 wechatLogin 逻辑
- 不引入 Tailwind/UnoCSS（约束禁止）
- sos 的紧急优先级标记不在本次（保持复用 check-in，见 §6 待确认）

---

## 3. 硬约束（已踩过的坑，重构必须遵守）

1. **API baseURL 必须用电脑局域网 IP**（当前 `http://192.168.31.158:3000/api/v1`），不能用 localhost/127.0.0.1。配置在 `src/api/client.ts` 的 `DEFAULT_API_BASE`。换电脑开发时改此 IP，或运行时 `uni.setStorageSync('apiBase', '...')` 覆盖。
2. **uni.scss 是全局注入文件**，会被注入到 node_modules 第三方组件——里面不能写相对路径 `@import`，变量必须内联定义。
3. **wot-design-uni 用 npm 安装时必须在 pages.json 配 easycom**（已配）：`"^wd-(.*)": "wot-design-uni/components/wd-$1/wd-$1.vue"`。库中无 wd-timeline，时间线用 wd-steps/wd-step。
4. **老人端页面不能用 Tailwind/UnoCSS 原子类**（小程序没配插件，原子类不生成 wxss）。统一用 BEM 自定义样式，参照 pagesWorker/risk-tasks/index.vue。
5. **所有 API 请求走统一客户端 src/api/client.ts**（luch-request），不要在页面里手写 uni.request + 相对 URL。唯一例外：文件上传用 `uni.uploadFile`（见 §5.2）。

---

## 4. 整体架构：补「身份链」的咽喉

重构主线是打通断裂的身份链，而非推倒重来：

```
登录(login) ──► 角色识别(role) ──►【新】解析关联老人(elderId) ──► 业务操作
                      │                    │
                      │           ┌────────┴────────┐
                      │           ▼                 ▼
                      │     eldersApi.findMine()   持久化到
                      │     (新后端接口)            auth store + storage
                      ▼
              isWorker/isAdmin → worker 页面（已就绪，复核）
              isElder(FAMILY) → elder 页面（重构重点）
```

### 4.1 关键架构决策

1. **elderId 收归 auth store**：不再散落在页面里 `getStorageSync`，改为 auth store 的 `currentElderId`（ref）+ `elders` 列表（多老人）+ `ensureElders()` 方法。消除根因 ❶❷。

2. **后端补 `GET /elders/mine` 作为咽喉接口**：elders.service.findAll 只按 district 过滤，FAMILY 查不到自己的老人（根因 ❶）。新增专门按 `ElderFamilyLink.userId = 当前用户` 查询的方法。

3. **删掉 auth.ts 里的死代码 `role === 'ELDER'`**（根因 ❻）：schema 的 Role 枚举没有 ELDER，wechatLogin 把微信用户 upsert 成 FAMILY。家属就是 FAMILY，`isElder` 简化为 `role === 'FAMILY'`。

---

## 5. 后端接口设计（apps/api）

每处改动标注解决的根因。原则：最小改动、复用现有鉴权模式。

### 5.1 新增 `GET /elders/mine` —— 解决根因 ❶❷（咽喉接口）

- **落点**：`elders.controller.ts` + `elders.service.ts`
- **契约**：
  ```
  GET /elders/mine        # 无分页，一个家属关联的老人通常 1~2 个
  Auth: 必须登录
  返回: { items: [ { id, name, serviceLevel, district } ] }
  ```
- **service 实现**（约 10 行，复用 prisma）：
  ```typescript
  async findMine(requester: Requester) {
    const links = await this.prisma.elderFamilyLink.findMany({
      where: { userId: requester.sub },
      include: { elder: { select: { id: true, name: true, serviceLevel: true, district: true } } },
    });
    return { items: links.map(l => l.elder) };
  }
  ```
- **为什么独立接口而非给 findAll 加 mine=true**：findAll 的语义是「片区筛选的管理列表」，FAMILY 不该走它（会撞上 district 过滤逻辑）。独立接口语义清晰，鉴权天然只看自己，不会误漏。
- **边界**：用户没有任何 familyLink 时返回 `{ items: [] }`。前端据此显示「未绑定老人」引导页（§7.3），不卡死。

### 5.2 放宽 `work-orders.findAll` 对 FAMILY 的鉴权 —— 解决根因 ❺

- **落点**：`work-orders.service.ts` 的 `findAll`（当前 182-186 行强制 district）
- **现状**：非 ADMIN 一律 `where.elder = { district: requester.district ?? '' }`，FAMILY 的 district 为 null → 查到空。
- **改法**（分角色，保持 worker 的 district 隔离不动）：
  ```typescript
  if (requester.role === Role.FAMILY) {
    // 家属只能看自己关联老人的工单
    const myElderIds = await this.prisma.elderFamilyLink.findMany({
      where: { userId: requester.sub }, select: { elderId: true },
    });
    where.elderId = { in: myElderIds.map(l => l.elderId) };
  } else if (requester.role !== Role.ADMIN) {
    // worker 保持原有 district 隔离
    where.elder = { district: requester.district ?? '' };
  } else if (district) {
    where.elder = { district };
  }
  ```
- **越权防护**：若 FAMILY 传入的 `elderId` 参数不在自己的关联列表内，抛 ForbiddenException（防止越权查他人老人工单）。
- worker 端逻辑零改动。

### 5.3 新增 `POST /uploads/audio` 代理上传 —— 解决根因 ❹

- **落点**：`uploads.controller.ts` + `uploads.service.ts`
- **契约**：
  ```
  POST /uploads/audio
  Content-Type: multipart/form-data
  Body: file=<录音文件>
  返回: { url, key }   # url 是 MinIO 对象的可访问路径
  ```
- **为什么代理而非预签名 PUT**：小程序 wx.uploadFile 是 POST multipart，无法直接 PUT 到 MinIO 预签名 URL。代理接口用 `@UseInterceptors(FileInterceptor)` 接收，后端 `PutObjectCommand` 转存 MinIO，返回最终 key。
- **voiceUrl 取值约定**：返回的 `url` 形如 `http://192.168.31.158:9000/care/checkins/xxx.m4a`，以 `.m4a`/`.mp3` 结尾，**满足 check-ins.service 对 voiceUrl 的 `.mp3/.wav/.m4a/.aac` 校验**（根因 ❹的后端侧）。
- **ContentType 校验**：复用 `uploads.service` 现有的 `FOLDER_ALLOWED_TYPES.checkins` 白名单（`audio/mp3, audio/wav, audio/m4a`），对 multer 接收到的 mimetype 校验，不合法直接 400。

### 5.4 本节不改的东西

- **不改 wechatLogin 的 upsert 逻辑**（仍 upsert 成 FAMILY）——这是对的。
- **不动 check-ins.service 的 familyLink 鉴权**——它是对的，前端走 findMine 拿到的就是已关联的老人，不会被 403。
- **不动 worker 端任何 controller**。

---

## 6. 前端 auth store + API 层重构（apps/miniapp）

### 6.1 auth store 重构：身份链的中枢

- **落点**：`src/stores/auth.ts`
- **新增字段**：
  ```typescript
  const elders = ref<ElderBrief[]>(uni.getStorageSync('elders') || []);
  const currentElderId = ref<string>(uni.getStorageSync('currentElderId') || '');
  const currentElder = computed(() =>
    elders.value.find(e => e.id === currentElderId.value) || null
  );
  // ElderBrief = { id, name, serviceLevel, district }（与 GET /elders/mine 返回一致）
  // 定义位置：src/composables/useElderIdentity.ts（新增的小类型模块），
  // 供 auth store 与页面共用，避免类型散落。
  ```
- **新增 `ensureElders()`**（登录/恢复会话后调，只在 FAMILY 角色执行）：
  ```typescript
  async function ensureElders() {
    if (!isElder.value) return;          // 非 FAMILY 直接跳过
    if (elders.value.length > 0) return; // 已缓存不重复拉
    try {
      const res = await eldersApi.findMine();
      elders.value = res?.data?.data?.items ?? [];
      uni.setStorageSync('elders', elders.value);
      if (elders.value.length > 0 && !currentElderId.value) {
        setCurrentElder(elders.value[0].id);  // 默认选第一个
      }
    } catch {
      elders.value = [];  // 静默失败，页面会显示「未绑定」引导
    }
  }
  function setCurrentElder(id: string) {
    currentElderId.value = id;
    uni.setStorageSync('currentElderId', id);
  }
  ```
- **职责调整**：
  - `login()` 成功后、`fetchUser()` 成功后，都调一次 `ensureElders()`。
  - `logout()` 里清掉 `elders` + `currentElderId`（现状只清 token/user，会残留老人身份）。
  - **删掉 `isElder` 里的 `role === 'ELDER'` 死代码**（根因 ❻），简化为 `role === 'FAMILY'`。
- **持久化策略**：elders + currentElderId 与 token/user 一样持久化。冷启动（无网络）时老人端仍能恢复上次选中的老人，与现有 user 持久化设计一致。

### 6.2 API 层修订

**`api/elders.ts`** —— 加 `findMine`：
```typescript
export const eldersApi = {
  getById: (id: string) => wrap(http.get(`/elders/${id}`)),
  getRiskProfile: (id: string) => wrap(http.get(`/elders/${id}/risk-profile`)),
  findMine: () => wrap(http.get('/elders/mine')),  // 新增
};
```

**`api/upload.ts`** —— 整体重写为代理上传（删掉错误的 getPresignedUrl）：
```typescript
export const uploadApi = {
  uploadAudio: (filePath: string) =>
    new Promise<{ url: string; key: string }>((resolve, reject) => {
      const token = uni.getStorageSync('token');
      const apiBase = uni.getStorageSync('apiBase') || DEFAULT_API_BASE;
      uni.uploadFile({
        url: `${apiBase}/uploads/audio`,
        filePath,
        name: 'file',
        header: token ? { Authorization: `Bearer ${token}` } : {},
        success: (res) => {
          const body = JSON.parse(res.data);
          if (body.code !== 0) return reject(new Error(body.message));
          resolve(body.data);  // { url, key }
        },
        fail: reject,
      });
    }),
};
```
**为什么绕过统一 client**：luch-request 处理 JSON，multipart 文件上传必须用 `uni.uploadFile`。这是唯一一个绕过统一 client 的合理例外，其他所有请求仍走 client。token 和 apiBase 手动注入，与 client 拦截器逻辑保持一致。

**`api/check-ins.ts` / `api/work-orders.ts`** —— 签名不变，只在使用处补参数（work-orders list 调用补 `{ elderId }`）。

### 6.3 client.ts 微调

现状 client.ts 主体正确，但有一处矛盾：业务错误（code !== 0）只 reject 不 toast，而页面 `catch {}` 注释写「client interceptor already shows toast」——这是假的。

**决策：不在拦截器加全局 toast，保持页面自治**（不同页面对同一错误提示诉求不同）。但修正页面的误导注释，把老人端页面的 catch 改成给用户真实反馈（如「网络异常，请重试」）。这点在 §7 页面重构统一处理。

---

## 7. 老人端页面 + 录音 composable 重构

worker 端页面已就绪，本节不碰。

### 7.1 useSosVoice.ts 重写：真录音 + 上传

- **落点**：`src/composables/useSosVoice.ts`
- 现状是 `setInterval` 假计时 + 假 voiceUrl（根因 ❹）。重写为基于 `uni.getRecorderManager()`：
  ```typescript
  export function useSosVoice() {
    const isRecording = ref(false);
    const duration = ref(0);
    const maxDuration = 60;
    const uploading = ref(false);          // 新：上传态
    const recordedFilePath = ref('');      // 新：录音临时路径
    let recorder = getRecorderManager();   // 惰性获取，避免测试环境无 uni
    let timer = null;

    function startRecording() {
      recordedFilePath.value = '';
      recorder.start({ format: 'mp3', duration: 60000, sampleRate: 16000 });
      // format 选 mp3：满足后端 check-ins 的 .mp3 校验
    }
    function stopRecording() {
      recorder.stop();   // 实际停止在 onStop 回调
    }
    // recorder.onStop 拿到 { tempFilePath, duration }
  }
  ```
- **关键设计点**：
  1. **`format: 'mp3'`**：微信 RecorderManager 支持 mp3/aac，选 mp3 既满足后端校验（`.mp3` 在白名单），真机兼容性好。
  2. **uploading 状态独立**：录音停止 → 上传是两段，UI 分别反馈（"发送中..."）。
  3. **`uploadAudio(tempFilePath)` 由页面在 stop 后调用**，不在 composable 里耦合上传逻辑——composable 只管"录"，"发"是页面的职责（check-in 报平安 vs sos 求助语义不同）。
  4. **保留单测可测性**：`getRecorderManager()` 用工厂函数包装，jsdom 测试里 mock，让 `isRecording`/`duration` 逻辑可测（更新 useSosVoice.spec.ts）。

### 7.2 check-in 页重构：接 store + 真语音

- **落点**：`src/pagesElder/check-in/index.vue`
- **改动点**（对照现状）：
  - `const elderId = ref(uni.getStorageSync('elderId'))` → **删**，改用 `auth.currentElderId`（根因 ❶❷）
  - ONE_TAP / TEXT 提交：`elderId` 从 store 取，validate 通过后正常调 `checkInsApi.create`
  - VOICE 提交：`stopRecording()` 后拿 `recordedFilePath`，调 `uploadApi.uploadAudio(filePath)` 得真 voiceUrl（`.mp3`），再 `checkInsApi.create({ method:'VOICE', voiceUrl })`（根因 ❹）
  - 保留 `duration < 1` 提示"录音太短"
  - **新增 uploading 反馈**：语音发送期间按钮显示"发送中..."，禁用重复点击
  - catch 块：现状空 catch（依赖假 toast），改为 `uni.showToast({ title: '提交失败，请重试', icon:'none' })`
  - 顶部加老人切换入口（见 §7.3）

### 7.3 sos 页重构

- **落点**：`src/pagesElder/sos/index.vue`
- **改动点**：
  - 删 `uni.getStorageSync('elderId')`，用 `auth.currentElderId`
  - 删 TODO 占位 `tempUrl = 'recorded_audio_' + Date.now()`，改真上传
  - 长按录音 → 松开 `stopRecording` → `uploadAudio` → `checkInsApi.create({ method:'VOICE', voiceUrl, content:'语音求助' })`
- **语义说明**：现状 sos 也调 `checkInsApi.create`（method: VOICE）。即"求助"和"语音报平安"走同一个后端接口，只是 content 文案不同。**后端无专门的 SOS 接口**。本次保持现状（求助 = 一次 VOICE 报平安，风险由 AI/规则判断）。"求助"是否有紧急优先级标记是产品决策点，列为 §11 待确认，不在本次实现。

### 7.4 order-progress 页重构：按老人过滤

- **落点**：`src/pagesElder/order-progress/index.vue`
- **改动点**：
  - `loadData()`：现状 `workOrdersApi.list({})`（全量）→ 改为 `workOrdersApi.list({ elderId: auth.currentElderId })`（根因 ❺）
  - 后端已放宽 FAMILY 鉴权（§5.2），所以能拿到数据
  - 进度条 / 时间格式 / AppCard 复用不变（已是 BEM 风格）
  - catch 给真实错误提示

### 7.5 新增：老人切换 + 未绑定引导

**(a) 老人切换入口**（已确认「单老人为主 + 列表切换」）：
- 在 check-in/sos 页顶部（AppNavbar 下方或内嵌）加老人切换条，显示 `auth.currentElder.name`，点击弹出 `wd-action-sheet` 选择其他关联老人
- 单老人时该条简化为只显示名字，不可点击
- 切换时调 `auth.setCurrentElder(id)`，页面 watch `currentElderId` 重新加载

**(b) 未绑定引导页**：
- 新增 `src/pagesElder/bind/index.vue`
- 当 `auth.elders.length === 0`（新注册家属未绑定），路由到此页
- 页面显示「您的账号尚未关联老人，请联系社区工作人员完成绑定」，附联系电话/说明
- 取代"卡死/未知状态"，让链路有明确出口

### 7.6 样式与交互统一规范（复核项，非重写）

老人端 3 页已是 BEM + 自定义样式（符合约束），几处不一致要统一：
- 加载态：统一用 `page-state`（risk-tasks 风格），check-in 无加载态、order-progress 有，对齐
- 空状态：统一用 `AppEmpty`（order-progress 已用，check-in/sos 无列表无空态，不用）
- 错误提示：统一 `uni.showToast({ icon: 'none' })`，文案前缀规范（"加载失败"、"提交失败"）
- 颜色：继续用 token 变量（uni.scss 内联），不引相对路径 @import

### 7.7 改动文件清单（本节）

| 文件 | 动作 |
|---|---|
| `composables/useSosVoice.ts` | 重写（真录音）+ 更新 spec |
| `composables/__tests__/useSosVoice.spec.ts` | 更新（mock RecorderManager） |
| `composables/useElderIdentity.ts` | **新增**（ElderBrief 类型 + 老人切换/加载辅助逻辑） |
| `pagesElder/check-in/index.vue` | 接 store + 真语音 + 错误处理 |
| `pagesElder/sos/index.vue` | 接 store + 真上传 |
| `pagesElder/order-progress/index.vue` | 按 elderId 过滤 |
| `pagesElder/bind/index.vue` | **新增**（未绑定引导） |
| `pages.json` | 注册 bind 页 |

---

## 8. 登录与角色路由流程（统一后）

### 8.1 流程

当前 `pages/index/index.vue` 的 `enterApp()` 用两层 Promise.race + 8s timeout 重复同一段路由判断（脆弱）。重构后：

```
启动 App / 点击"进入工作台"
  │
  ▼
有 token + 缓存 user？（冷启动恢复）
  ├─ 是 → 直接路由（不联网，沿用 onMounted 自动跳转）
  │       isWorker/isAdmin → worker 风险待办
  │       isElder          → ensureElders → 有老人去 check-in / 无老人去 bind
  │
  └─ 否 → 联网分支
          fetchUser()
            ├─ 成功 → 路由（同上）
            └─ 失败（token过期/无token）→ uni.login() → auth.login(code)
                  ├─ 成功 → 路由
                  └─ 失败 → 真实 toast（"登录失败：xxx"），停在首页
```

### 8.2 改动要点

- **抽出单一 `routeByRole()` 函数**，消除 enterApp 里两处重复的路由 if-else（现状第 34-45 行和 59-70 行几乎相同）
- **ensureElders 只在 isElder 分支调用**，非 FAMILY 不拉 elders（避免 worker 无谓请求）
- **保留 timeout 保护**，但单一化：把 fetchUser 和 login 各包一层 timeout，而非嵌套。8s 超时后给明确文案"网络超时，请确认后端已启动（localhost:3000）"
- onMounted 自动跳转保持不变（已是正确设计：有完整会话才跳，不联网）

---

## 9. 验证计划（每改一处 → 构建 → 微信开发者工具验证）

每阶段都有可观测的验收点。

> 下方阶段编号 A/B/C/D/E 是**验证分组**，与 §10 排期表里 A→E→B→C 的**执行顺序**是两套体系：验证按功能域分组，排期按依赖关系排序。

### 阶段 A：后端接口（可独立验证）
- `GET /elders/mine`：启动后端，用现有 FAMILY 用户 token 调，返回关联老人列表
- `work-orders.findAll`：FAMILY token 带 elderId 调，返回该老人工单（验证不再被 district 拦）
- `POST /uploads/audio`：用 curl 上传一个 .mp3，返回可访问 url
- **验证方式**：Swagger（http://localhost:3000/api/docs）+ 后端单测
- **验收**：Swagger 三个接口可见且返回正确

### 阶段 B：前端 auth store + API 层
- 构建 `npx uni build -p mp-weixin`
- 微信开发者工具导入 dist/build/mp-weixin
- **验收**：登录后 console 能看到 elders 被拉取、currentElderId 写入 storage（开发者工具 Storage 面板可见）

### 阶段 C：老人端闭环（核心验收）
- 登录 FAMILY 账号 → 进入 check-in → **一键报平安成功**（Toast"已报平安"）
- 长按语音 → 松开 → "发送中" → **报平安成功**（验证真录音上传，开发者工具 Network 面板能看到 POST /uploads/audio）
- 进入 sos → 长按求助 → 成功
- 进入 order-progress → **看到该老人的工单**（非空，或明确空状态）
- 未绑定账号 → **进入 bind 引导页**（不卡死）

### 阶段 D：worker 端复核
- 登录 GRID_WORKER/ADMIN → 进入 risk-tasks → 列表正常 → 复核流程通
- work-order list/detail → 接单/完成流程通
- visit-form 填报 → 提交成功
- **验收**：这三个流程不被老人端重构带坏（回归测试）

### 阶段 E：数据准备（前置依赖）
- 阶段 C 前必须有：一个 FAMILY 用户 + 已建 ElderFamilyLink 关联 + 该老人有至少一条工单
- 否则老人端会一直空/报"未绑定"
- **这部分用 prisma seed 或手动 SQL 准备**，写进实施计划

---

## 10. 分阶段排期与优先级

按"先打通链路咽喉、再补全页面"的顺序，每阶段可独立构建验证：

| 阶段 | 内容 | 优先级 | 依赖 | 验收点 |
|---|---|---|---|---|
| **A** | 后端三接口（elders/mine、work-orders 鉴权、uploads/audio） | P0 | 无 | Swagger 可调通 |
| **E** | 数据准备（FAMILY+link+工单 seed） | P0 | A | DB 有测试数据 |
| **B** | 前端 auth store + API 层（elders.findMine、uploadAudio、删 ELER） | P0 | A | storage 写入 currentElderId |
| **C1** | useSosVoice 真录音重写 + spec 更新 | P1 | B | 录音生成真 .mp3 |
| **C2** | check-in/sos/order-progress 三页接 store | P0 | B | 一键报平安成功 |
| **C3** | bind 引导页 + 老人切换入口 | P1 | C2 | 未绑定有出口、可切换 |
| **C4** | 路由流程统一（routeByRole、ensureElders 接入） | P0 | B | 登录即跳对页面 |
| **D** | worker 端回归复核（不改实现，只验证） | P2 | C2 | worker 流程不被带坏 |

**关键路径**：A → E → B → C2/C4（打通主流程），C1/C3 是增强，D 是回归保险。

---

## 11. 风险、回滚与待确认

### 11.1 风险

- **风险 1：模拟器录音**：微信开发者工具里 `getRecorderManager` 在模拟器上可能行为异常（真机更可靠）。**缓解**：C1 阶段先在模拟器验证 `isRecording/duration` 计时正确，录音上传若模拟器不支持，标注"需真机验证"，不阻塞主流程（一键报平安/文字报平安不依赖录音）。
- **风险 2：MinIO 未启动**：uploads/audio 失败。**缓解**：后端接口在 MinIO 不可达时返回明确错误，前端 catch 给"上传失败，请稍后重试"。降级路径：语音报平安失败不影响文字报平安。

### 11.2 回滚

- 每阶段独立提交。
- 后端接口是新增（不破坏现有）。
- 前端改动若出问题可单阶段 revert。

### 11.3 待确认（不在本次实现，记录备查）

- **sos 紧急优先级**：求助是否需要独立紧急接口/优先级标记？本次保持复用 check-in（求助 = VOICE 报平安 + content 文案），后端靠 AI/规则判断风险。
