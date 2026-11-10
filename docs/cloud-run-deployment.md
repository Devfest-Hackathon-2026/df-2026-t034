# Google Cloud：匿名测试部署与手机联调

2026-11-06，负责人已确认取消手动邀请，改为临时匿名会话。以下为实际部署，旧邀请记录保留在验证历史中。

## 当前服务

- 项目：`gen-lang-client-0997218352`，复用原项目，未新建项目。
- API：`https://japan-travel-chat-930889374458.asia-northeast1.run.app`。
- 服务 `japan-travel-chat`，Cloud Run 与 Firestore 在东京 `asia-northeast1`。
- Vertex `gemini-3.1-flash-lite`，global 推理端点，不能承诺模型处理仅在东京。
- 运行源码 `4f5cf99`；当前 revision `japan-travel-chat-00007-9mc`。
- Cloud Build `1c71c648-527e-48bb-af4a-5c9b4948544b`；镜像 digest `sha256:b016b11adef737a927f33d68c930ed493b46fbbaaa49142272e1c162c2ad3470`。
- `CHAT_ACCESS_MODE=shared`、`CHAT_ALLOW_ANONYMOUS_TEST=true`；运行身份 ADC 调用 Vertex，无 API 密钥或服务账号 JSON 注入。

## 手机：只启动 Expo

先保存自己的修改，拉取 `feat/shared-gemini-service` 的完整项目。手机目录 `.env.local`：

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://japan-travel-chat-930889374458.asia-northeast1.run.app
EXPO_PUBLIC_CHAT_ACCESS_MODE=shared
```

```sh
git fetch origin
git switch feat/shared-gemini-service
git pull --ff-only
cd japan-travel-mobile
npm ci
npx expo login --browser
npx expo start --go --lan --clear
```

退出旧项目，扫描自己终端的普通 Expo 二维码，进入 AI 规划自动连接。不需要邀请、激活、Gemini 密钥或会员，也不启动本地 AI 后端。CLI 和手机使用同一个自己的 Expo 账号。两位测试者可在不同网络，但各自手机须能连接自己的开发电脑。GitHub 不托管 App；本阶段仍不是永久安装包。

已有 `.env.local` 先备份，只更新公开配置。Windows 使用 `npm.cmd` / `npx.cmd`；Mac EMFILE 可暂用 `CI=1 npx expo start --go --lan --clear --port 8085`，CI 不监听修改，改代码需重启。完整排查见 [队友交接](teammate-debugging.md)。

## 服务端开关与持久化保护

| 配置 | 当前值与作用 |
| --- | --- |
| CHAT_ALLOW_ANONYMOUS_TEST | true；模板/默认 false，关闭后拒绝新签发及已有匿名会话的后续生成 |
| CHAT_DAILY_REQUEST_LIMIT | 100，每 UTC 日整个项目受理的生成总量，包含旧邀请及新匿名会话，失败生成也占用 |
| CHAT_SESSION_DAILY_REQUEST_LIMIT | 20，每会话每日受理量；不是按人或业务账号 |
| CHAT_ANONYMOUS_SESSION_DAILY_LIMIT | 100，每日签发上限，独立于生成次数 |
| CHAT_SESSION_HOURS | 4；手机 SecureStore 保存短期会话，数据库只保存凭据摘要 |

所有日总量与会话限制均在 Firestore 事务执行，换会话、服务重启、多实例不能清空总量。匿名可重复领取，不能证明只有两位用户；此局限已由负责人接受。以后另做业务登录和按账号配额。

保留每进程生成并发 2、全局短时 30/分钟及共享桶 10/分钟；启动 20/分钟、并发 2。最多 40 条、每条 4,000 字符、合计 32,000 字符、128 KiB；输出 2,048 tokens，生成截止 45 秒，只有 503 重试一次。启动服务端等待 10 秒、手机 15 秒，失败不自动循环。

`POST /api/session` 空 JSON `{}` 自动签发，后续 `/api/chat` 仍须 Bearer 会话，无会话 401。客户端不能打开服务端开关或选择 provider、模型及项目。聊天正文只在手机页面内存；Firestore 保存会话摘要、计数与可得用量，不保存正文。到期记录暂未自动删除。

## 关闭与恢复匿名测试

负责人使用已有云管理登录：

```sh
gcloud run services update japan-travel-chat \
  --project=gen-lang-client-0997218352 --region=asia-northeast1 \
  --update-env-vars=CHAT_ALLOW_ANONYMOUS_TEST=false
```

等待新 revision Ready 后，空会话申请和已有匿名会话后续聊天都返回 403 `ANONYMOUS_TEST_DISABLED`。恢复测试将 false 改为 true；手机按需重新连接。此开关只管理匿名模式，历史邀请兼容实现仍存在；若要停止所有接口，按下方删除这一个 Cloud Run 服务，或另外撤销历史邀请。

## 资源与权限

| 资源/身份 | 现有范围 |
| --- | --- |
| Cloud Run | 最小 0、目标最大 1；1 CPU / 512 MiB，容器并发 8，请求 60 秒 |
| Firestore | 东京默认库，STANDARD / Native；只供服务端访问，不给手机数据库凭据 |
| travel-chat-runtime | 默认数据库条件限定的 roles/datastore.user；自定义 travelChatPredict 仅含 aiplatform.endpoints.predict、serviceusage.services.use |
| travel-chat-build | 指定源码桶 objectViewer、镜像仓库 writer、项目 logging.logWriter |
| 镜像/源码 | 东京私有 travel-chat 仓库与源码桶；只归档已提交服务端源码，不上传环境文件 |
| Secret Manager | 旧 gemini-api-key 版本未用于 Vertex，运行账号读取授权已撤回；没有为匿名模式新增秘密 |

平台 allUsers invoker 保持原授权；应用层签发/验证短期会话。匿名模式不构成业务身份认证。此次没有新增 IAM 角色、数据库或付费升级。

## 费用

使用已批准的 Google Cloud 免费试用范围，没有充值或升级。仅有 Cloud Welcome Credit，未提供比赛特定赠金。Developer API 曾实测 402 要求预付款，因此经批准改用 Vertex；会员聊天额度不抵 API 用量。实际赠金抵扣仍需查看账单，成功调用不代表已经逐笔对账。

Vertex global 当前标准文本价：每百万输入 token US$0.25、输出（含 thinking）US$1.50。每次 3,000 输入/1,000 输出，100 次约 US$0.225，未含重试及平台成本，不能当最高费用承诺。Cloud Run、构建、存储、数据库与网络各自计费。次数限制、最大实例及预算通知都不是金额硬上限；新增充值、付费升级或权限仍由负责人确认。

参考：[Vertex 价格](https://cloud.google.com/model-garden/pricing)、[Cloud 试用范围](https://docs.cloud.google.com/free/docs/free-cloud-features)、[Gemini Developer API 计费](https://ai.google.dev/gemini-api/docs/billing/)、[Cloud Run](https://cloud.google.com/run/pricing)、[Firestore](https://cloud.google.com/firestore/pricing)。

## 重新部署

保存并提交服务端修改，只归档已跟踪文件。替换 COMMIT_ID 和私有路径，不上传本机 env、ADC 或私钥：

```sh
git archive --format=tar.gz --output=/PRIVATE/PATH/source.tar.gz HEAD:japan-travel

gcloud builds submit /PRIVATE/PATH/source.tar.gz \
  --project=gen-lang-client-0997218352 --region=asia-northeast1 \
  --config=japan-travel/deploy/cloudbuild.yaml \
  --substitutions=_IMAGE=asia-northeast1-docker.pkg.dev/gen-lang-client-0997218352/travel-chat/api:COMMIT_ID \
  --service-account=projects/gen-lang-client-0997218352/serviceAccounts/travel-chat-build@gen-lang-client-0997218352.iam.gserviceaccount.com \
  --gcs-source-staging-dir=gs://gen-lang-client-0997218352-travel-build/source
```

构建成功后读取 digest。复制 `japan-travel/deploy/cloud-run.service.yaml` 到私有工作文件，填写原项目、固定域名、digest 镜像地址。模板匿名开关默认 false，当前内部测试需明确改为 true。保持 Vertex/global 和现有 SA，不添加 API 密钥。

```sh
gcloud run services replace /PRIVATE/PATH/cloud-run.resolved.yaml \
  --project=gen-lang-client-0997218352 --region=asia-northeast1
```

检查 IAM、环境、健康、无会话拒绝及实际匿名回复。云地址稳定，换镜像通常不改手机 URL。真实 HTTP 检查会消耗最多 6 次生成：

```sh
node japan-travel/scripts/verify-shared-cloud.mjs \
  https://japan-travel-chat-930889374458.asia-northeast1.run.app \
  /PRIVATE/PATH/report.json
```

不再需要邀请文件。报告无会话凭据，但包含固定测试对话，请妥善保存。它不能代替两台手机与不同网络。

## 不用时停止服务

匿名开关关闭可阻止匿名生成，但不删除其他云资源。若需停止本项目这一个 API 服务，负责人确认配置备份后：

```sh
gcloud run services delete japan-travel-chat \
  --project=gen-lang-client-0997218352 --region=asia-northeast1
```

无流量且最小 0 可缩到零，不代表镜像、数据库、秘密和源码存储都免费。按资源清单另外清理不需保留的数据和镜像，不误删团队其他资源或整个项目；不自动关闭结算账号。

## 本次实际验证

- 52 项：后端 33、手机 18、整合 1；两端 lint/TypeScript、后端构建和 standalone HTTP smoke 通过。
- Cloud Build 成功，当前 revision Ready；公开健康 200，无会话聊天 401，客户端指定开关的激活体 400。
- 空 JSON 无邀请签发 200；两个独立匿名会话交替三轮，6 次真实 Gemini 200，各自保留东京动漫美食与京都寺庙、改两天；HTTP 不代替真机。
- 实际关闭开关：新签发 403、此前签发的匿名会话聊天 403；重新开启后恢复成功。
- 使用实际手机请求封装，从无旧会话开始自动签发并收到真实 Gemini 回复；运行在 Node，不冒充手机。
- 真 Firestore 临时测试集合验证签发上限、会话上限、多实例/并发总量限制；测试总量设为 2，结束后清理，仅测试逻辑，不真实耗尽 100 次付费调用、不改生产计数。
- 修复版 iOS 开发 bundle 200，有新匿名存储，旧邀请输入与激活按钮已不存在，未发现本机 Gemini 密钥。
- 核对当前云环境：匿名 true、生成总量 100、会话 20、签发 100、Vertex provider，无 GEMINI_API_KEY / GOOGLE_APPLICATION_CREDENTIALS 环境项。检查当前 revision 36 条日志，未发现本机真实密钥、专用测试会话或长 Bearer token 模式；不代替长期日志审计。
- 用户已确认两台手机在不同网络使用新版匿名入口收到真实回复，均无需粘贴链接或激活。
- 用户已分别提供东京双人动漫美食与京都单人寺庙的手机回复，条件各自独立，历史隔离通过。
- **仍待确认**：停止本地后端后继续聊天及全部真机错误提示。旧邀请版单手机三轮作为历史单列，不代替其余匿名新版项目。

完整分阶段记录见 [验证记录](chat-validation.md)。


## 维护账号交接

指定的队友 Google 账号已按资源范围授权现有服务更新、构建提交、指定源码桶与镜像读取、两个现有服务账号 actAs，以及两个过滤日志视图读取。没有授予 Owner/Editor、IAM 管理、密钥读取或账号文件。角色绑定已回读核对；队友本人首次登录和部署仍需自检，见 [ジョ维护交接](jo-cloud-deploy-handoff.md)。本次没有改变正在运行的镜像或提示词。
