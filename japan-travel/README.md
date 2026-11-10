# Tabi 日本旅游 AI：Next.js 服务端

当前新增临时匿名测试：负责人在服务端设置 `CHAT_ALLOW_ANONYMOUS_TEST=true` 后，手机自动签发短期会话，不再手动邀请。默认 false，关闭后已有匿名会话也不能调用。生成日限额仍由 Firestore 执行；签发另有每日 100 上限。详见 [匿名测试说明](../docs/anonymous-testing.md)。

本目录提供 `POST /api/chat`，由服务端调用 Gemini，供 `japan-travel-mobile` 的 iPhone 聊天页面使用。此目录只提供 API，不包含网页界面。唯一用户界面位于 `../japan-travel-mobile`。根地址返回 `{"service":"Japan Travel API","status":"ok"}`，用于连通性检查。

`CHAT_ACCESS_MODE=shared` 为统一 HTTPS 服务，Firestore 持久化会话和日限额。当前临时匿名测试由服务器 `CHAT_ALLOW_ANONYMOUS_TEST=true` 开启，`POST /api/session` 空 JSON 自动签发；手机无需邀请或密钥。Vertex 运行身份与云端手册一致。下面 local 规则仅供独立开发。

## 独立本地启动（手机测试者不需要）

使用 Node.js LTS；自动测试需要 Node.js 22.18 或更新版本的内置 TypeScript 支持。首次进入本目录运行：

```sh
npm ci
```

复制 `.env.example` 为 `.env.local`，只在本机填写：

```dotenv
CHAT_ACCESS_MODE=local
GEMINI_PROVIDER=developer
GEMINI_API_KEY=你的真实密钥
GEMINI_MODEL=该密钥所属项目可用的文字模型ID
```

此处是可选 Developer API 路线；先在 Google AI Studio 确认自己的模型和额度。团队项目 Developer API 目前实测 402 需要预付款，已改用 Cloud 试用内的 Vertex，不要为了复制本地流程自行充值。模型没有默认值；旧教程中的模型名可能已经变化。密钥不能放进 `NEXT_PUBLIC_`、`EXPO_PUBLIC_`、手机项目或仓库，也不要发送到聊天。

```sh
npm run dev -- --hostname 0.0.0.0
```

修改环境变量后重启服务。电脑可访问 `http://localhost:3000`。手机必须与电脑在同一可互访的 Wi-Fi，手机端 `.env.local` 中的 `EXPO_PUBLIC_API_BASE_URL` 填电脑的局域网地址，例如 `http://192.168.1.5:3000`。这个 IP 仅为例子；手机上不能用 `localhost` 访问电脑。

完整操作与 iPhone 验收见 [两端启动说明](../docs/iphone-chat-setup.md)。

## API 约定

请求头为 `Content-Type: application/json`，消息从 `user` 开始，与 `assistant` 交替，最后一条为 `user`：

```json
{
  "messages": [
    { "role": "user", "content": "东京三日游" },
    { "role": "assistant", "content": "请问人数和预算？" },
    { "role": "user", "content": "两人经济型，改为两天" }
  ]
}
```

成功 HTTP 200：`{"reply":"真实 Gemini 回复"}`。

失败返回适当状态码，例如 HTTP 503：

```json
{"error":{"code":"MISSING_API_KEY","message":"服务端尚未配置 GEMINI_API_KEY，请先在 .env.local 中填写密钥并重启服务。"}}
```

常见代码包括 `INVALID_CONVERSATION`、`MESSAGE_TOO_LONG`、`CONVERSATION_TOO_LONG`（400），`BODY_TOO_LARGE`（413），`RESPONSE_BLOCKED`（422），`RATE_LIMITED` / `GEMINI_RATE_LIMITED`（429），`MISSING_API_KEY` / `MISSING_MODEL` / `GEMINI_AUTH_ERROR` / `MODEL_UNAVAILABLE` / `SERVER_BUSY` / `GEMINI_BILLING_REQUIRED` / `MISSING_VERTEX_CONFIG` / `INVALID_GEMINI_PROVIDER`（503），`GEMINI_TIMEOUT`（504），以及 `EMPTY_RESPONSE` / `RESPONSE_TOO_LONG` / `GEMINI_UNAVAILABLE`（502）。限流或繁忙响应带 `Retry-After` 秒数。上游短暂过载（503）时 SDK 等待 1 秒后重试一次；其他情况由用户主动重试，不返回模拟成功。

## 云端 Vertex 配置

`GEMINI_PROVIDER=vertex`、`GOOGLE_CLOUD_PROJECT=gen-lang-client-0997218352`、`GOOGLE_CLOUD_LOCATION=global`、`GEMINI_MODEL=gemini-3.1-flash-lite`，配合 shared 配置与专用运行身份 ADC。不要设置 Gemini API 密钥或打包服务账号 JSON；管理邀请时的个人 ADC 仅放负责人本机。已授权的自定义预测角色只含 `aiplatform.endpoints.predict`、`serviceusage.services.use`；Firestore IAM 条件限默认数据库。部署模板在 `deploy/`，重新部署和运行管理见 [手册](../docs/cloud-run-deployment.md)。

## 调用控制与当前边界

- 上限为 40 条消息、单条 4000 字符、总计 32000 字符、请求体 128 KiB；超限明确拒绝，不截掉先前对话。字符数按 JavaScript 字符串长度计算。
- 每次最多 2048 输出 token，整次请求（包括重试）45 秒截止，超时取消上游。仅对上游 503 过载自动重试一次，最多两次上游调用；429 配额不足、认证和输入错误不会重试。成功回复最多 4000 字符，过长或被截断的回复返回可读错误。
- 单进程每分钟最多 30 次受理，每个本地客户端桶最多 10 次，同时最多 2 次。无 socket IP 时使用共享本地桶；转发 IP 只是尽力区分，不能当成用户身份。所有请求还受全局上限约束。
- 限额按受理的用户请求计数；每个请求因 503 重试最多产生两次上游调用，重试期间继续占用同一个并发名额。
- local 的短时限额存于本进程内存，重启或热更新后可能重置。shared 另有 Firestore 事务持久化每日项目 100 次、每会话 20 次，重启不会清空。Host / Origin 检查仅是本地开发辅助，不能替代认证、可信代理和正式服务端限额。
- 只允许 `npm run dev` 下的本地或私有网络地址，也兼容部分 IPv6 过渡网络使用的非全球地址 `192.0.0.0/29`（例如 `192.0.0.2`）；这不保证手机能直接路由到该地址，仍需真机验证。拒绝其他网站来源的浏览器请求。Expo 原生请求不需要浏览器 CORS。没有认证，不能通过端口转发、公开隧道或云部署公开此接口。local 在生产模式始终返回 `LOCAL_DEVELOPMENT_ONLY`；已获授权的 shared 模式通过邀请会话访问。
- 日志仅包含模型、状态、耗时、消息数量、输入输出字符数和 token 数量；不记录密钥、完整对话、原始上游错误或堆栈。本阶段不保存聊天或行程。

## 验证

```sh
npm test
npm run lint
npm run build
```

自动测试使用注入的模拟 provider，覆盖输入、完整多轮消息转换、字节限制、来源限制、调用控制、超时取消、上游错误、输出长度和日志隐私；另使用真实 SDK 配合模拟 HTTP 传输，验证 503 只重试一次、429 和认证错误不重试，不会访问 Gemini 或消耗额度。构建通过不代表真实密钥或模型可用；真实验收仍需在 iPhone 连续完成“东京三日游 → 两人经济型 → 改为两天”，确认能够保留并修改条件。

`npm run build` 仅表示构建通过。默认 `local` 模式在生产运行不开放聊天；`shared` 模式在已配置并获得部署授权的生产环境中，只允许有效邀请会话访问。

Google Places 照片（默认关闭）、完整对话需求判断与部署确认见 [本轮交接](../docs/places-guided-planning.md)。
