# 日本旅行助手 · 手机端

唯一用户界面，Expo SDK 58 / React Native。支持真实 AI 连续聊天、聊天历史、中英日语言、发现搜索与筛选、本机保存行程、预算与每日安排、准备清单和外部预订网页。界面采用暖白背景、白色卡片与朱红点缀。

## 队友独立打开，不需要 Jackkie 的账号密码

AI 规划自动建立匿名测试会话，不需要业务登录、邀请、Gemini 会员或 API 密钥。**Expo Go 是开发工具：队友用自己的 Expo 账号登录自己的电脑和手机即可**，不用登录 Jackkie 的账号。

在仓库手机端目录运行：

```sh
npm ci
# 仅首次复制；已有 .env.local 时保留并检查公开云端配置。
cp .env.example .env.local
npx expo login --browser
npx expo whoami
npm run start:go
```

手机 Expo Go 登录与自己电脑相同的账号，然后扫描**自己电脑**生成的二维码。手机和自己的电脑先连接同一 Wi-Fi；连接不通时停止当前预览，改用 `npm run start:tunnel`，按官方提示安装隧道工具。不要设置 `EXPO_OFFLINE=1` 或 `CI=1`，不要转用 Jackkie 的登录凭据。

公开配置如下，不含任何秘密：

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://japan-travel-chat-14289984868.asia-northeast1.run.app
EXPO_PUBLIC_CHAT_ACCESS_MODE=shared
```

手机端不启动 AI 后端。队友和 Jackkie 可以在不同网络连接同一个云端服务，各自的 Expo 开发电脑仍需保持运行。已有聊天和行程保存在本机，不会同步到队友手机。转发 Jackkie 的临时二维码不保证不同 Expo 账号可以打开，也不等于永久发布。

服务端继续执行每日总量、单会话、并发与超时控制；匿名入口可由服务端关闭。额度用完或会话过期时按页面提示处理，不能无限重试绕过限制。应用内没有共用秘密。

## 检查与交接

```sh
npm test
npm run lint
npx tsc --noEmit
```

- [队友完整启动步骤与扫码排查](../docs/teammate-expo-preview.md)
- [三语言与云端配置](../docs/language-support.md)
- [暖白界面交付与验证边界](../docs/warm-ui-preview-2026-11-10.md)
- [行程与预订能力](../docs/saved-trips-and-booking.md)
- [照片与规划交接](../docs/places-guided-planning.md)

未实现业务账号、跨设备同步、站内订单支付或独立安装包。预订入口打开供应方网页，不代表实时库存或价格。
