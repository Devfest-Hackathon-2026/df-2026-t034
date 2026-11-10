# 共享 Gemini 服务

当前改为临时匿名测试，负责人已确认不再手动邀请。手机进入 AI 规划自动取得短期会话，之后每次聊天仍带会话凭据；不是直接裸调 Gemini。

`Expo 手机 → Cloud Run shared API → Firestore 会话/持久化日限额 → Vertex Gemini`

- API：`https://japan-travel-chat-930889374458.asia-northeast1.run.app`。
- 项目复用 `gen-lang-client-0997218352`；Cloud Run/Firestore 东京，Vertex `gemini-3.1-flash-lite` 为 global 推理端点。
- 运行身份 ADC 调用 Vertex，不向手机分发 Gemini 凭据或共用秘密。
- 自动会话：`POST /api/session` 空 JSON `{}`；聊天：`POST /api/chat`，Bearer 短期会话 + 完整 messages。
- `CHAT_ALLOW_ANONYMOUS_TEST=false` 默认关闭；本次测试由负责人明确开启。关闭后拒绝新会话和已有匿名会话。
- 整个项目每日 100 次生成、每会话每日 20 次，通过 Firestore 事务持久化；另每日最多签发 100 个匿名会话，默认 4 小时。

匿名可以重复领取，不能作为每人或会员额度；即使换会话也不能重置项目总量。没有业务登录/支付/旅行包扣除，本阶段不假装能识别是否只有两位测试者。

完整配置与保护见 [匿名测试](anonymous-testing.md)，手机拉取/启动见 [队友交接](teammate-debugging.md)，部署/权限/费用/关闭方式见 [云端手册](cloud-run-deployment.md)。原邀请管理服务端实现保留兼容，手机邀请输入、自动兑换邀请与相关提示已移除；旧邀请真机记录只作为历史。
