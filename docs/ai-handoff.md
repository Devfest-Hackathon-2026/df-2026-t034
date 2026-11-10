# Jackkie：Gemini 接入任务（第一阶段）

**最新要求：负责人已于 2026-11-06 确认改为匿名测试，取消手机手动邀请。当前行为与配置以 [匿名测试说明](anonymous-testing.md) 和 [最新队友交接](teammate-debugging.md) 为准。下面保留之前阶段约定，不能覆盖后续明确授权。**


当前完整交付分支为 `feat/shared-gemini-service`，队友从 [最新调试交接](teammate-debugging.md) 开始。2026-11-06 已按负责人后续授权部署东京 Cloud Run + Firestore，改用 Vertex 运行身份，真实云端对话已通过；双手机不同网络验收待完成，详见 [云端手册](cloud-run-deployment.md)。

下面保留第一阶段本地接入约定作为历史。后续已确认的共享云端方案优先于其中「仅本地」「不做正式云部署」等阶段边界；业务登录、会员、支付、行程保存与独立安装包仍不做。

负责完整的 AI 聊天接入：japan-travel 中的 Gemini 服务端、japan-travel-mobile 中的 AI 规划聊天页面、两端连接与真机调试。完成标准是负责人能够在自己的 iPhone App 里和真实 Gemini 连续对话，而不是只交付接口。

## 工具
Node.js LTS、GitHub Desktop、编辑器（VS Code 或 Codex 均可）、Google AI Studio 账号。
真机测试需安装 Expo Go；开发服务与 Expo Go 按要求登录同一个自己的 Expo 账号，不共享个人密码。Windows + iPhone 的 Expo Go 调试无需 Unity、Android Studio 或 Xcode。
克隆仓库后创建 feat/gemini-api 分支，进入 japan-travel，npm ci。
安装官方 JavaScript SDK：npm install @google/genai。
手机端进入 japan-travel-mobile，npm ci，然后 npx expo start --go --lan（Windows 可用 npx.cmd）。

## 手机端与联调范围
正式产品以 japan-travel-mobile 中的 Expo 手机 App 为准；旧网页界面已从仓库删除。japan-travel 只用于 API，不能在这里另做聊天网页代替手机功能。
- 负责 src/app/planner.tsx、相关聊天组件、请求封装和服务端地址配置，必要的依赖与配置可以修改并说明原因。
- AI 规划页包含对话列表、多行输入、发送按钮、等待状态、错误提示和主动重试；等待时防止重复发送，键盘不遮挡输入区域。
- 服务端地址通过 EXPO_PUBLIC_API_BASE_URL 配置；这个值只是地址，可以公开，绝不能放入 API 密钥。提供无秘密的 .env.example。
- 手机访问电脑服务时不能填 localhost，需使用手机可达的电脑局域网地址；前后端分别启动，注明手机和电脑同一 Wi-Fi 等条件。
- 先在自己的手机完成多轮对话，再与负责人联调。双方不在同一网络时，一起确认安全的远程测试方式，不能把自己的局域网二维码当成对方随时能打开的在线 App。
- 完成后提交代码并协助负责人拉取更新、配置本机密钥与地址、运行服务，直到负责人 iPhone 上验证成功。
- 首页、攻略、行程与设置业务由另一位成员负责，不重做这几页；共享导航的必要改动提前沟通。

## 目标与接口约定
实现 POST /api/chat。第一阶段是非流式 JSON 文字对话。
请求：
{"messages":[{"role":"user","content":"我想去东京三天"},{"role":"assistant","content":"请问人数和预算？"},{"role":"user","content":"两人，经济型"}]}

messages 使用 user / assistant，最后一条为 user。服务端转换成 Gemini 所需格式，不直接信任客户端提供的 system 指令。
成功 HTTP 200：{"reply":"真实 Gemini 回复"}
失败：适当 HTTP 状态码，{"error":{"code":"错误类型","message":"不包含密钥或内部堆栈的用户说明"}}。

## AI 行为
- 日本旅游规划助手，默认用中文，根据用户明确要求调整回复语言。
- 信息不足时先询问目的地、日期或天数、人数、预算、兴趣，不必每轮重复问已提供的信息。
- 支持多轮修改同一趟旅行，不能每轮忘记先前条件。
- 不将未核实的票价、营业时间、预订网址说成已确认的事实。
- 本阶段仅返回文字；结构化行程、确认保存留待下一阶段约定。

## 密钥与调用控制
- 使用服务端 GEMINI_API_KEY，从 .env.local 读取。提交无真实值的 .env.example。
- 模型使用服务端配置 GEMINI_MODEL；先核实项目可用模型与免费额度，不自行开启付费、充值。
- 验证 messages 的格式、角色、数量、单条长度与总长度；设置回复上限与请求超时。
- 处理空回复、限流、无效密钥、上游故障；不无限自动重试。
- 只记录必要的 token 用量、模型、状态，不记录密钥或完整私人对话。
- 仅本地开发；没有用户认证和服务端限额之前，不公开部署付费调用接口。

## 验收与交付
1. 真实调用成功：东京三日游 -> 两人经济型 -> 改为两天，三轮能保留并修改条件。
2. 非法请求被拒绝；缺密钥、超时、限流等有合理错误响应。
3. 服务端 npm run build 通过；手机端 lint 和 TypeScript 检查通过，完成 iPhone 真机对话测试。
4. README 写明环境变量、安装启动步骤、模型、请求/返回示例。
5. Pull Request 说明修改文件、测试结果与已知限制；不得把密钥和登录令牌放进说明。
6. 交付可运行的手机聊天页面、服务端、两端启动说明和配置示例，并协助负责人在其 iPhone 上验证连续对话与错误处理。

权限说明：GitHub 协作者接受邀请后可以在开发仓库创建分支并提交这些修改，不需要仓库管理员权限。仓库权限不等于 Expo、Google Cloud、结算账号或远程控制别人手机的权限；如需额外云权限，先明确用途和范围再由负责人确认授权。

不做：Google 登录、微信登录、会员支付、免费行程次数扣除、行程保存、正式云部署。
