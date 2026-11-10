# DF Hack26 接手说明

更新于 2026 年 11 月 8 日。团队名「睡眠不足」，产品是面向日本旅行者的 iPhone AI 规划 App。Rean 和 Jackkie 共用 [私有开发仓库](https://github.com/Rean0623/japan-travel-ai/tree/feat/guided-travel-chat)，以 `feat/guided-travel-chat` 为接手基线。主办方另有提交仓库，向 Rean 核对官方邀请、会场和提交入口。每次开始新改动前先跟 Rean 确认范围。

## 在手机上跑起来

- `japan-travel-mobile` 是 Expo SDK 58 / React Native 客户端。保留 Jackkie 的现有白底黑灰 UI 和底部导航。 `japan-travel` 是 Next.js API，根地址返回健康 JSON。
- 用有私有仓库访问权的 GitHub 账号拉取开发分支。另一个 Codex 账号不会自动继承这里的 GitHub 和 Google Cloud 登录或权限。使用有权访问的账号或已登录的本机仓库，云端维护用自己的已授权 Google 账号。
- 进入 `japan-travel-mobile`，运行 `npm ci`。把 `.env.example` 的两项复制到 `.env.local`，再运行 `npx expo start --go --lan --clear`。如果 Expo CLI 未登录，先用 `npx expo login --browser` 登录手机 Expo Go 使用的账号。Windows PowerShell 可用 `npm.cmd` 和 `npx.cmd`。
- 手机扫自己电脑生成的二维码，进入「AI 规划」。同一人的手机和电脑需要能在局域网互访，两位队友可以各用各的 Wi-Fi。App 自动申请匿名会话。手机只需要公开地址与 `shared` 模式，无需 Gemini 密钥、邀请或本地 AI 后端。

## 当前云端

| 项目 | 实际配置 |
| --- | --- |
| Google Cloud 项目 | `gen-lang-client-0217481921`，Rean 的结算项目 |
| 服务 | `japan-travel-chat`，东京 `asia-northeast1`，当前已验证修订版 `japan-travel-chat-00002-bkv` |
| Expo API 地址 | `https://japan-travel-chat-14289984868.asia-northeast1.run.app` |
| 模型 | `gemini-3.8-flash`，Vertex global，Cloud Run 服务账号自动认证 |
| 会话 | Firestore 东京默认库。每日 100 次生成、每个会话每日 20 次、每日签发 100 个匿名会话，UTC 日计数，会话 4 小时 |

Rean 本机 Expo 已切换。Jackkie 拉取后需核对自己的 `.env.local` 并重新加载。旧团队后端仍在原地址，旧会话和用量记录留在原项目。向新地址发出的请求使用 Rean 的 Google Cloud 结算。当前为免费试用，到期或额度耗尽会暂停服务，付费升级由 Rean 自己决定。

新服务由现有 `kyoto-starter` 服务端源码包构建，随后用环境变量切换模型。开发分支还包含较新的客户端图片匹配改动。GitHub 推送与 Cloud Run 部署是独立步骤。新项目使用 `travel-chat-runtime` 与 `travel-chat-build` 服务账号、`travel-chat` 镜像仓库和 `gs://gen-lang-client-0217481921-travel-build/source` 构建暂存路径。先看当前 Cloud Run 配置，使用 [构建配置](../japan-travel/deploy/cloudbuild.yaml) 和 [部署模板](../japan-travel/deploy/cloud-run.service.yaml)。旧交接里的云项目和命令是历史记录。源码打包只包含项目文件，凭据、`.env.local`、支付信息和比赛赠金兑换码保存在各自原处。

## 优先解决真机偶发失败

云端验证过 Gemini 3.8 Flash 的东京动漫美食三日行程，三天齐全，HTTP 200，约 25 秒。Rean 随后在 iPhone 上测试跨城市行程，偶尔看到「连接不上旅行助手，请检查手机网络后重试」。2026 年 11 月 8 日 14:04（日本时间），同一时段的新接口有一条 iOS/Expo `POST /api/chat`，Cloud Run 记录 HTTP 200、约 33.35 秒，响应约 8 KB。请求到达云端，页面仍报错。具体是传输中断还是客户端处理异常，尚无证据定论。

1. 用同一部 iPhone、同一个新接口复测短行程和较长跨城市行程，记录发送时间、是否切后台、Wi-Fi 环境以及是否重试成功。测试句可以用「哈尔滨出发，想去日本的北海道、京都、北京、大阪、福冈，能帮我推荐行程吗」。北京可能指转机，也可能是笔误，澄清后再安排。
2. 对照 `japan-travel-mobile/src/lib/chat.ts` 的 `sendChatRequest`、`src/lib/shared-chat-session.ts` 和 `src/hooks/use-planner-chat.ts`。先区分会话签发、手机 fetch、取消和读取响应。当前聊天请求客户端超时是 105 秒，普通网络异常会落到同一句提示。Cloud Run 返回 200 只能证明服务端记录了响应。复测时可用安全的关联 ID、阶段、耗时和错误类型，避免记录对话正文、令牌和完整请求头。
3. 保留现有交互。用户可以在回复期间输入草稿，发送在回复完成后恢复。新消息移动到可视区域顶部，回复从上到下展开，读长回复时允许手动滚动，底部按钮可回到最新消息。真机验证成功后再考虑部署修复。

## 产品范围与下一步

- AI 规划已接入多轮对话、按日行程、渐进显示、横图和三档预算切换。规划回复先给一段总览，再按 Day 列每日目标、实际会去的重点景点及相符实景图、每日安排，最后小结、三档预算和柔和追问。尽量一次给全程天数，每天用一列行程，推荐时段可用括号补在条目后。用「您」，景点或餐厅优先展示日文原名，中文译名有帮助时放括号内。
- 景点图片仍是已核对本地素材加 Wikipedia、Wikidata 和 Wikimedia Commons 查询。`src/lib/place-photos.ts` 与 `src/lib/reviewed-place-photos.ts` 负责选图。偏好清晰、有辨识度的实景外观，图片横放在对应介绍下。每天最多 4 张，优先核心景点，可配合美食。缺可靠图时跳过图片占位。实时 Google 图片搜索是待验证方向，现有 App 尚未接入。若将来采用 Google 图片搜索，保留清晰的来源入口，并按官方展示要求验证实景匹配和来源导航。
- 发现、行程、设置和导航已有页面。待完成的主流程是攻略搜索与 Tag → 攻略图文和预算选择 → 携带攻略上下文进入 AI 规划 → 确认行程并保存到「行程」。行程页需要支持多个计划、按日查看、预订链接和手动勾选。设置先做语言。赛后再讨论 Google 或微信登录、账号额度和付费。
- 建议用真实用户路径验收。两端可分别运行 `npm test`、`npm run lint` 和 `npx tsc --noEmit`。后端改动再运行 `npm run build`，随后核对云端和真机。能在 Expo Go 打开属于开发测试，比赛演示和评审如何打开仍需要实际验证。

## 比赛提交

资料依据为官方 Kickoff Slide 第 14、31–37、42–49 页与 [活动官网](https://df-hack26.gdgs.jp/)。

- 参赛类别选「観光」。正式开发从 11 月 5 日 10:00 开始，主办方禁止把开发开始前的验证 PoC 代码搬进正式项目。Google 技术要在产品中发挥核心作用，Cloud Run 属于指定运行基座之一。本项目可展示 Cloud Run、Vertex AI Gemini 和 Firestore 如何支撑行程规划与会话。
- **暂按 11 月 10 日 17:00 日本时间安排提交。** Kickoff 第 33、49 页写 17:00，总日程第 14 页写 19:00。提交前向主办方 Discord 核对最终时间、会场、表单和官方仓库。Regional Day 是 11 月 14 日，部署 URL 至少保持可用到当天。Demo Day 是 11 月 27 日。
- 准备官方 GitHub 仓库、按模板填写的产品说明文档、真实演示视频、著作物利用表。现场会场另交 pitch 幻灯片，线上会场提交含演示的 presentation 视频。入围现场 pitch 时至少一名队员到场。
- 用对应会场的 Google 表单提交官方 GitHub 链接和 Google Drive 文件夹链接。按官方要求把提交文件夹设置为知道链接的人可查看，并用无登录或评审视角验证。素材表核对景点照片、图标、库与数据的作者、来源和许可证。文档写明开发时在哪里使用 AI、为什么，以及团队学到了什么。
- 演示优先走通一条真实路径，展示用户如何从旅行需求得到完整计划、调整行程和比较预算。提交前复核所有演示声明和实测状态。
