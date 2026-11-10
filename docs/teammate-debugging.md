# 队友调试：普通 Expo Go 入口 + 匿名云端

当前分支 `feat/shared-gemini-service`，见 [PR #2](https://github.com/Rean0623/japan-travel-ai/pull/2)。2026-11-06 最新分工取消手动邀请；进入 AI 规划自动建立匿名测试会话。

## 获取最新代码

首次：

```sh
git clone --branch feat/shared-gemini-service https://github.com/Rean0623/japan-travel-ai.git
cd japan-travel-ai
```

已有仓库先保存自己的修改，再从仓库根目录执行：

```sh
git fetch origin
git switch feat/shared-gemini-service
git pull --ff-only
```

若 fast-forward 被拒绝，先检查双方提交，不要重置或强推覆盖。需要 Node.js 22.18+ 的兼容 LTS、兼容 SDK 58 的 Expo Go。

## 配置并运行手机项目

```sh
cd japan-travel-mobile
npm ci
```

将 `.env.example` 复制为 `.env.local`；已有文件先备份，再只更新这两项：

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://japan-travel-chat-930889374458.asia-northeast1.run.app
EXPO_PUBLIC_CHAT_ACCESS_MODE=shared
```

```sh
npx expo login --browser
npx expo start --go --lan --clear
```

Windows PowerShell 复制用 `Copy-Item`，脚本受限用 `npm.cmd` / `npx.cmd`。CLI 和手机使用同一个你自己的 Expo 账号，不共享 Jackkie 密码。

退出旧项目，用 iPhone 相机扫描**自己终端的普通 Expo 二维码**，进入 AI 规划，等待自动连接后直接输入。无需邀请链接、激活按钮、Gemini 密钥或会员，也不启动 `japan-travel`。

两位测试者不必在同一 Wi-Fi；各自手机须能访问自己的 Expo 电脑。云端不依赖负责人电脑，Expo Go 仍依赖自己的开发服务。GitHub 不提供永久运行的手机安装包。

## 验证

同一段对话发送：①我想去东京三天。②两个人，经济型，喜欢动漫和美食。③改成两天，保留动漫和美食。第三轮核对城市、人数、预算偏好、兴趣及两天修改。

两位用户再使用不同目的地/人数/兴趣，确认不串历史。停止旧本地 AI 后端，保留 Expo，再检查能否聊天。记录网络是否不同与实际结果；旧邀请版或电脑测试不能替代新版手机验收，见 [验证记录](chat-validation.md)。

## 排查

- 仍看到邀请输入或提示：拉取最新完整分支，停止自己旧 Expo，重新 `--clear` 启动并退出/重开项目。
- 匿名测试已关闭：负责人需核对服务端 `CHAT_ALLOW_ANONYMOUS_TEST`。不要在手机加秘密或更改限额。
- 会话结束：点击重新连接。新对话不重置额度；重新领取也不能绕过项目总量。
- 当日额度用完：等下一 UTC 日或联系开发者；不自动重试、充值或绕过限制。
- 项目打不开：检查手机到自己的 Expo 电脑、兼容 SDK、账号和 iOS 本地网络权限。
- 能开但聊天连接失败：核对两个公开环境项并重启 Expo；Safari 打开云端根地址应返回健康 JSON。
- Mac EMFILE：可暂用 `CI=1 npx expo start --go --lan --clear --port 8085`；Windows 先 `$env:CI='1'`，用后 `Remove-Item Env:CI`。CI 不自动监听修改，改代码后重启。选择自己的空闲端口。

本阶段对话只在页面内存中，退出/Reload/新对话会清空；业务登录、支付、结构化行程保存和实时搜索未实现。
