# 队友用自己的账号预览

更新：2026-11-10。仓库 `Rean0623/japan-travel-ai`，分支 `feat/places-guided-planning`，PR #5。现有 AI 入口是匿名测试，进入后自动建立独立短期会话，不要求 Jackkie 的账号密码、邀请、Gemini 密钥或会员。

## 在自己的电脑启动

已有本地修改时先查看 `git status`，保留修改后再同步；遇到业务冲突再沟通，不使用强制重置。

首次克隆：

```sh
git clone --branch feat/places-guided-planning https://github.com/Rean0623/japan-travel-ai.git
cd japan-travel-ai
```

已有仓库且工作区干净时：

```sh
git fetch origin
git switch feat/places-guided-planning
git pull --ff-only origin feat/places-guided-planning
```

进入手机端，使用当前锁文件安装，不升级整个 SDK：

```sh
cd japan-travel-mobile
npm ci
# 仅首次执行复制；已有文件时跳过。
cp .env.example .env.local
npx expo login --browser
npx expo whoami
npm run start:go
```

官方浏览器登录使用**队友自己的 Expo 账号**，不要把密码或验证码放在聊天或命令参数里。手机 Expo Go 也登录队友自己的同一账号。扫描自己终端显示的二维码即可，不需要 Jackkie 的 Expo 项目权限。此仓库没有绑定 Jackkie 的 owner 或 EAS 项目 ID；不要为了扫码改 slug、scheme 或存储键，以免影响现有本机记录。

公开配置：

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://japan-travel-chat-14289984868.asia-northeast1.run.app
EXPO_PUBLIC_CHAT_ACCESS_MODE=shared
```

进入 AI 规划等待自动连接，然后发送一条真实需求。不要启动 `japan-travel` 本地后端，也不要在手机配置 Gemini/Places 凭据。

## 连接失败时

- 手机和自己的电脑先连接同一 Wi-Fi。局域网无法互访时，停止该预览，运行 `npm run start:tunnel`，按 Expo 官方提示准备隧道工具。SDK 58 也支持指定已安装的旧隧道提供方：`npm run start:tunnel -- ngrok`。
- 不设置 `EXPO_OFFLINE=1` 或 `--offline`：本项目实测离线预览会缺少已登录用户信息，手机可能显示“已登录 Expo Go，但未登录 Expo CLI”。联网登录并重新启动后，退出旧错误页，扫描新二维码。
- 不设置 `CI=1` 做交互开发，以免关闭文件监听和 Fast Refresh。
- 若仍提示账号不一致，用 `npx expo whoami` 核对电脑账号与手机 Expo Go 账号。登录自己的同一账号，而不是索取 Jackkie 密码。
- 停止电脑开发服务后 Expo Go 无法继续加载项目；GitHub 不会自动启动或永久托管手机预览。各位测试者可在不同网络运行各自的 Expo，AI 都连接同一个云端地址。

当前 Jackkie 的二维码依赖他的开发服务和 Expo 账号校验，不能承诺直接转发即可打开。以上独立启动方式无须共享密码。将来若要只靠手机长期使用，另行安排安装包或测试分发，不属于本次 Expo Go 交付。

## 验证记录

本轮本机核对了 SDK 58 的 Expo CLI 登录与启动选项；现有预览的 iOS manifest 和完整开发包可访问，携带正确的 Jackkie 预览账号信息。此前不同网络两台手机连接云端真实 AI 的验收已经通过。**本次队友拉取这次 UI 更新、用自己的 Expo 账号打开，仍须在他的设备验证**，不能代替其真机验收。

参考：[Expo CLI 官方说明](https://docs.expo.dev/more/expo-cli/)。
