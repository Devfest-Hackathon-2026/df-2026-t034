# 临时匿名测试

2026-11-06 负责人已确认本阶段取消手动邀请。进入手机 AI 规划后自动建立匿名短期会话；没有邀请输入、激活按钮，不提供 Gemini 密钥或共用秘密。已实际部署到现有 Cloud Run，空请求签发与真实 Gemini 对话通过；关闭开关已实测新会话和已有匿名会话均被拒绝。两台手机不同网络均已由用户确认无邀请收到真实回复；历史隔离也已通过，停止本地后端及全部真机错误提示仍分开核对，见 [云端记录](cloud-run-deployment.md)。

手机公开配置保持：

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://japan-travel-chat-930889374458.asia-northeast1.run.app
EXPO_PUBLIC_CHAT_ACCESS_MODE=shared
```

拉取 `feat/shared-gemini-service`，在 `japan-travel-mobile` 安装依赖、重启 Expo 并清缓存：`npx expo start --go --lan --clear`。扫描自己开发电脑的普通 Expo 二维码，进入 AI 规划即可自动连接。两位测试者可在不同网络，但各自手机仍须能访问自己的 Expo 开发电脑；无需本地 AI 后端。

服务端只在 `CHAT_ACCESS_MODE=shared` 且 `CHAT_ALLOW_ANONYMOUS_TEST=true` 时签发匿名会话。开关默认 false；关闭后既拒绝签发，也拒绝已有匿名会话生成。开关仅在服务端，不打包入手机。

- 生成额度：Firestore 事务保存，每 UTC 日整个项目 100 次、每会话 20 次，失败生成也计数。换会话和服务重启不能重置总量。
- 会话：4 小时，只有随机短期凭据，数据库保存 SHA-256 摘要。手机 SecureStore 新命名空间不会复用旧邀请会话。
- 签发额度：`CHAT_ANONYMOUS_SESSION_DAILY_LIMIT=100`，单独持久化每天最多 100 个匿名会话，签发本身不消耗生成次数。
- 启动请求每进程最多 20 次/分钟、并发 2、10 秒服务端等待；手机 15 秒截止，Strict Mode 重挂共享一次请求，不循环重试。
- 生成继续保留并发 2、短时调用限制、40 条/单条 4,000/合计 32,000 字符、128 KiB、输出 2,048 tokens、45 秒截止、仅 503 重试一次。

这是匿名测试入口，无法识别是否确实只有两位队友，也不能把会话限额当每人限额。重复领取可能获得新会话额度，但全部受项目总量约束。预算提醒、最大实例和这些次数限制不是金额硬上限。后续业务登录再改按账号分配额度。

`POST /api/session` 接受空 JSON `{}`，返回短期 `sessionToken` / `expiresAt`；后续聊天仍必须带 Bearer 会话。无会话调用 `/api/chat` 返回 401。客户端不能打开服务端开关或指定 provider/模型。邀请管理旧实现留作兼容，不再用于当前手机流程。
