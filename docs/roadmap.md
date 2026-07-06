# Skill Hub 演进路线图

> 状态:仅规划,不立即开发。每个条目列出「现状 / 目标 / 做法 / 参考 / 成本 / 触发条件」,便于将来按需取用。
>
> 参考资料:iflytek/skillhub(企业级开源 skill registry,3774★,Java/Spring Boot + Postgres)。我们定位是轻量内部市场(Next.js + 文件系统),不照搬,只借鉴设计思路,并标注与文件系统存储的适配方式。

## 设计原则(优先借鉴)

这几条是 iflytek 设计里**与具体技术栈无关**的通用原则,适合直接采纳:

1. **状态机正交拆分** —— 容器状态 / 版本状态 / 审核状态 / 可见性 四个独立维度,不要塞进一个 `status` 字段。我们当前 `submission.status` 混了审核和发布,未来加版本时应拆开。
2. **前端 UX ≠ 安全边界** —— 前端隐藏按钮只是体验优化,后端每个写操作必须独立校验权限。**我们已做到**(`verifyAuth()` 每个写接口),需坚持。
3. **不可变资源 + 指针** —— 已发布版本号永久占用,`latest` 是自动跟随的指针而非手动维护。防止误覆盖、支持回滚。
4. **服务端不碰客户端本地状态** —— 服务端只返回元数据,`location`/AGENTS.md 等本地态由客户端计算。我们走原生 marketplace 协议,天然符合。
5. **治理操作留痕** —— publish/delete/edit/hide/yank 等操作写审计日志,满足合规与追责。

---

## Phase 1:补短板(近期 · 低成本高收益)

### 1.1 版本号不可变性 + latest 指针 ★最高优先级

- **现状**:`publishSubmission` 直接替换 `published-plugins.json` 里同名条目,单版本覆盖,无回滚。
- **目标**:同一插件保留多版本,`PUBLISHED` 版本不可变(版本号永久占用),`latest` 自动指向最新已发布版本,支持按版本安装/回滚。
- **做法(适配文件系统)**:
  - 目录布局:`data/plugins/<name>/<version>/`(每版本独立目录,不再覆盖)
  - `published-plugins.json` 条目改为:`{ name, ..., versions: [{ version, status, publishedAt, sha256, dir }], latestVersion: "<version>" }`
  - 重新发布 → 新增 version 条目,不动旧 PUBLISHED 版本
  - `latestVersion` 只能指向 `status=PUBLISHED` 的版本;yank 命中 latest 时重算指针(下一个 PUBLISHED 或 null)
  - 详情页加版本选择器;下载/install 默认走 latest,支持 `@<version>`
  - git marketplace sync:同步 latest 版本文件(或按需支持版本化 install)
- **参考**:`iflytek 14-skill-lifecycle.md`(latest 指针语义、yank 指针修正)、`02-domain-model.md`(skill_version 表、版本号不可变性表)
- **成本**:中。改存储布局 + publish 流 + 详情页 + 下载解析。无需引入 DB。
- **触发条件**:出现「新版有 bug 想回滚」或「想同时维护 v1/v2」的需求时。

### 1.2 审计日志

- **现状**:只有 `download-log.json`(仅下载),publish/delete/edit 无留痕。
- **目标**:治理操作(publish/delete/edit/hide/yank/login)写审计日志,可查谁在何时做了什么。
- **做法**:`data/audit-log.json`(append-only,定期轮转),字段参考 iflytek `audit_log`:actor / action / targetType / targetId / clientIp / timestamp / detail。在 `storage.ts` 各写函数里加 `appendAudit(...)`。管理后台加只读审计页。
- **参考**:`iflytek 02-domain-model.md` audit_log 表
- **成本**:低。纯 JSON 追加 + 一个只读页。
- **触发条件**:合规要求,或出问题需要追责时。

### 1.3 幂等上传

- **现状**:提交审核无幂等,网络重试会产生重复 submission。
- **目标**:客户端带 `request_id`(UUID),服务端去重,重试返回首次结果。
- **做法**:`data/idempotency-record.json`({request_id, resourceType, resourceId, status, createdAt, expiresAt}),`/api/contribute` 入口校验。内存 Map 做快速去重 + JSON 持久化兜底。过期记录定时清理。
- **参考**:`iflytek 02-domain-model.md` idempotency_record 表
- **成本**:低-中。
- **触发条件**:贡献者反馈「提交了但不确定成没成功,不敢再点」时。

---

## Phase 2:治理增强(中期)

### 2.1 多版本完整生命周期

- **现状**:`submission.status` = pending/approved/rejected/published(单版本,混审核+发布)。
- **目标**:拆成正交维度——版本状态(DRAFT/PENDING_REVIEW/PUBLISHED/REJECTED/YANKED)+ 审核状态(PENDING/APPROVED/REJECTED)+ 容器状态(ACTIVE/ARCHIVED)+ 可见性(hidden)。支持撤回审核(PENDING_REVIEW→DRAFT,可逆)、重传新版本(旧待审自动降 DRAFT)、yank 已发布版本。
- **做法**:在 1.1 版本目录布局之上,给每版本加 `status`,submission 与 version 合并为一棵版本树。读模型用 lifecycle projection(public 只认 PUBLISHED,owner 可预览 PENDING_REVIEW)。
- **参考**:`iflytek 14-skill-lifecycle.md`(完整状态机、projection、权限边界)
- **成本**:中-高。建立在 1.1 之上。
- **触发条件**:1.1 落地后,审核流程变复杂(撤回、重传、yank)时。

### 2.2 简单角色(reviewer)

- **现状**:单 admin(可审核 + 可配置)。
- **目标**:增加 `reviewer` 角色(只能审核上架,不能改环境变量/密码),减轻 admin 负担。
- **做法**:`auth.ts` 引入角色字段(环境变量配 reviewer 列表,或 `data/users.json`),`verifyAuth` 改为返回角色,各 API 按角色判定。**不引入完整 RBAC 表**。
- **参考**:`iflytek 03-authentication-design.md`(但只取「角色拆分」思路,不抄 4 角色 + namespace 体系)
- **成本**:低。
- **触发条件**:审核与运维职责需要分离时。

### 2.3 服务端全文搜索

- **现状**:前端 `useMemo` 过滤 registry + published,插件多了会卡。
- **目标**:服务端搜索,支持分页、按分类/下载量排序。
- **做法**:无 DB 方案——内存建倒排索引(启动时从 registry.json + published-plugins.json 构建),`/api/search` 查询;或引入 lunr/flexsearch。插件规模 <500 时前端方案其实够用。
- **参考**:`iflytek 04-search-architecture.md`、`02-domain-model.md` skill_search_document(Postgres FTS,我们不抄 DB 方案)
- **成本**:低-中。
- **触发条件**:插件数 >200,或前端搜索明显卡顿时。

---

## Phase 3:平台化(长期 · 需评估必要性)

这一阶段改造大,只在**确有跨团队共享需求**或**要从内部工具升级为公司级平台**时才考虑。多数会**引入 PostgreSQL + Redis**(脱离文件系统存储),是质变。

### 3.1 namespace + RBAC

- **目标**:按团队划分命名空间,每空间有 OWNER/ADMIN/MEMBER,平台角色 SUPER_ADMIN/SKILL_ADMIN/USER_ADMIN/AUDITOR。namespace ADMIN 不受 owner 限制(解决人员流动)。
- **参考**:`iflytek 02-domain-model.md` §3.2、`03-authentication-design.md` §6
- **成本**:高。数据模型、UI、安装坐标(`@team/skill`)全改。**需引入 DB**。
- **触发条件**:多个团队各自治理、互不干扰的需求出现时。

### 3.2 OAuth/SSO + 准入策略

- **目标**:OAuth2 登录(GitHub/企业 OIDC)+ Access Policy 准入层(邮箱域名/白名单),取代共享 admin 密码。
- **参考**:`iflytek 03-authentication-design.md` §2-3(5 层认证架构、AccessDecision 三态)
- **成本**:中-高。
- **触发条件**:需要审计「谁发布了什么」(配合 1.2 审计),或共享密码不再可控时。

### 3.3 CLI + REST API + API Token

- **现状**:走 Claude Code 原生 marketplace 协议,无 CLI。
- **目标**:自建 CLI(`skillhub install <name> --agent codex`)+ REST API + 作用域 API Token(程序化发布/CI 集成)。
- **参考**:`iflytek 07-skill-protocol.md`、CLI 设计、`api_token` 表
- **成本**:高。
- **触发条件**:需要支持非 Claude 工具的程序化安装,或 CI 自动发布插件时。**注意**:这可能与我们「走原生 marketplace 协议」的轻量定位冲突,需权衡。

### 3.4 可插拔存储(S3/MinIO)

- **现状**:文件系统,单实例。
- **目标**:存储层抽象,dev 用文件系统,prod 可切 S3/MinIO,支持 HA/大文件。
- **参考**:`iflytek 02-domain-model.md` skill_file(object_key)
- **成本**:中。
- **触发条件**:多实例部署,或插件包体积超过文件系统承载时。

### 3.5 K8s/Helm + 监控

- **现状**:Docker Compose(仅 web)/ systemd+nginx。
- **目标**:K8s 部署 + Helm + Prometheus/Grafana。
- **参考**:`iflytek 09-deployment.md`、monitoring/
- **成本**:中-高。
- **触发条件**:公司基础设施要求 K8s,或需要 SLA 监控时。

### 3.6 i18n

- **现状**:中文。
- **目标**:i18next 多语言。
- **成本**:低-中。
- **触发条件**:有非中文用户时(内部工具一般不需要)。

---

## 明确不跟进的(iflytek 有但我们不需要)

| 功能 | 不跟进理由 |
|------|-----------|
| 社交(收藏/评分) | 内部用,价值低,徒增维护 |
| 账户合并(多 OAuth 身份) | 单 OAuth 场景下无需求 |
| ClawHub 兼容层 | 我们走原生 marketplace 协议,不自建 CLI 就不需要 |
| progressive disclosure / `.astron/metadata.json` | CLI 私有实现,无 CLI 则不需要 |
| 设备授权(Device Flow) | 无 CLI 则不需要 |

---

## 决策清单

每个 Phase 启动前,先回答:

1. **触发条件满足了吗?** —— 别为做而做,内部工具的最大优势是简单。
2. **需要引入 DB 吗?** —— Phase 1-2 都能文件系统搞定;Phase 3 多数需要 PostgreSQL + Redis,是质变,需单独评估。
3. **是否破坏原生 marketplace 协议兼容?** —— 我们的核心优势是 `claude plugin marketplace add` 原生接入,任何改动都别破坏这条。
4. **iflytek 的哪条设计可以剥离 DB 假设后适配?** —— 多数状态机/审计/幂等思路与存储无关,可降级到 JSON;RBAC/搜索/namespace 则强依赖 DB。

---

## 建议的落地顺序

```
Phase 1 (补短板,文件系统内可完成)
  1.1 版本号不可变性 + latest 指针   ← 最大功能短板,优先
  1.2 审计日志                       ← 低成本,合规第一步
  1.3 幂等上传                       ← 改善贡献体验
        │
        ▼
Phase 2 (治理增强,仍在文件系统能力内)
  2.1 多版本完整生命周期              ← 建立在 1.1 之上
  2.2 简单 reviewer 角色
  2.3 服务端搜索(按需)
        │
        ▼  (此处以下需评估是否引入 DB,质变点)
Phase 3 (平台化,按需)
  3.1 namespace + RBAC
  3.2 OAuth/SSO
  3.3 CLI + REST API
  3.4 可插拔存储 / 3.5 K8s / 3.6 i18n
```

**核心判断**:Phase 1 是「无论未来怎么走都该做」的补强;Phase 2 是「内部规模变大时」的演进;Phase 3 是「定位从内部工具升级为公司级平台时」的质变,届时应认真考虑直接参考 iflytek/skillhub 而非自研。
