# 独立本地 API：iPhone 联调（可选）

当前默认使用已部署的共享云端，普通队友请按 [云端手机步骤](teammate-debugging.md) 操作，只启动 Expo，不申请密钥。本文保留独立本地 API 开发流程；团队 Developer API 当前返回 402，不保证下述项目有免费额度，不自行充值。

本阶段交付两部分：电脑上的 Next.js 服务端，以及 Expo Go 中的「AI 规划」聊天页面。手机只保存服务端地址，Gemini 密钥只在服务端。普通文字多轮聊天先通过，下一阶段再约定结构化行程和保存。

## 1. 取得代码

首次使用：

```sh
git clone https://github.com/Rean0623/japan-travel-ai.git
cd japan-travel-ai
git switch feat/shared-gemini-service
```

已有仓库时先保存自己的修改，再运行 `git fetch origin`，切换或拉取 `feat/shared-gemini-service`。也可以在 GitHub Desktop 切换该分支。PR 合并后使用 `main` 并拉取最新代码。

安装 Node.js LTS（22.18 或更新版本）和手机上的 Expo Go。保留仓库既有 Expo SDK 版本；如果 Expo Go 提示 SDK 不匹配，按提示核对兼容版本，不要直接升级整个项目。编辑器使用 Codex、VS Code 等均可。

## 2. 创建免费测试用密钥

打开 [Google AI Studio](https://aistudio.google.com/apikey)，使用自己的 Google 账号。首次条款、项目创建和凭据授权由账号持有人确认。

在 API keys 页面确认项目的计费状态、模型及免费额度。需要创建项目或密钥时，先确认用途为本次本地聊天开发。如果要求开启结算、绑定付款方式、充值或额外 IAM 权限，先与项目负责人确认；本指南不要求开启付费。

在 `japan-travel/` 将 `.env.example` 复制为 `.env.local`，填写：

```dotenv
CHAT_ACCESS_MODE=local
GEMINI_PROVIDER=developer
GEMINI_API_KEY=这里替换为你本机的真实密钥
GEMINI_MODEL=这里替换为该项目可用且已确认免费额度的模型标识
```

不要将密钥发到聊天、PR、截图或手机代码中。`GEMINI_MODEL` 的示例不是可用性承诺：以 AI Studio 中该项目当时可使用的模型为准。修改这两个值后重启服务端。密钥和真实本机地址文件已经由 Git 忽略。

## 3. 启动服务端

在第一个终端：

```sh
cd japan-travel
npm ci
npm run dev -- --hostname 0.0.0.0 --port 3000
```

终端显示 Ready 后保持开启。本阶段使用开发服务，`npm run build` 用于编译检查，不代表允许公开部署。生产环境的 local 聊天接口会被禁用，shared 云端另有邀请保护。

如果特定受限环境报 `unable to start FSEvent stream`，可改用 `npm run dev -- --webpack --hostname 0.0.0.0 --port 3000`。在 macOS/Linux 需要轮询文件变化时，可在这条命令前加 `WATCHPACK_POLLING=true`。

## 4. 找到电脑局域网地址

手机和电脑需在同一 Wi-Fi，网络不能启用访客隔离。

- Windows：运行 `ipconfig`，找当前 Wi-Fi 网卡的 IPv4 地址。
- macOS：在「系统设置 → Wi-Fi → 详细信息 → TCP/IP」查看 IP 地址。

这里要的是电脑当前 Wi-Fi 网卡的局域网 IP，不是上网搜索「我的 IP」得到的公网地址或 IP 介绍网页。需要在 Safari 的地址栏输入完整的 `http://IP:3000/` 并点「前往」，不要将它输入 Google 搜索框。

例如电脑 IP 为 `192.168.1.23`，手机使用的服务端地址是 `http://192.168.1.23:3000`。不要用 `localhost`、`127.0.0.1`、`0.0.0.0` 或 Expo 的 `exp://` 地址作为手机 API 地址。手机中的 `localhost` 指手机本身。

先在 iPhone Safari 访问该 HTTP 地址，应看到 `{"service":"Japan Travel API","status":"ok"}`。这说明手机连得上服务端；此 JSON 是服务状态，手机 App 要通过 Expo Go 打开。系统如要求允许 Node.js 接收入站连接，仅为当前可信的本地网络授权；不要关闭整个防火墙。

## 5. 配置并启动手机端

在 `japan-travel-mobile/` 将 `.env.example` 复制为 `.env.local`：

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.23:3000
EXPO_PUBLIC_CHAT_ACCESS_MODE=local
```

把示例 IP 改成第 4 步查到的本机地址。此变量只是地址，可以进入手机包；不能放 Gemini 密钥。

另开一个终端：

```sh
cd japan-travel-mobile
npm ci
npx expo start --go --lan
```

Windows PowerShell 若阻止脚本，使用 `npm.cmd`、`npx.cmd`。如 Expo 要求登录，在电脑和手机上使用自己的同一个 Expo 账号，密码只在官方登录界面输入。

用 iPhone 相机扫描终端二维码，通过 Expo Go 打开，允许访问本地网络。进入「AI 规划」，输入需求并发送。更改 `.env.local` 后完整 Reload App；如仍使用旧地址，重启 Expo，必要时加 `--clear`。Wi-Fi 或电脑 IP 改变后要更新 API 地址并 Reload。

## 6. 三轮验收

在同一段对话依次发送：

1. 「我想去东京三天。」
2. 「两个人，经济型，喜欢动漫和美食。」
3. 「改成两天，保留动漫和美食的安排。」

确认回复来自真实 Gemini，后两轮保留东京、两人、经济型及兴趣，第三轮按两天修改。等待期间不能重复发送，键盘弹出后输入框和发送按钮应仍可用。

还需实际检查：断网或停止服务端后显示清楚的错误；恢复连接后点「重试」能继续，失败的用户消息不重复出现。使用页面中的新对话操作后，旧对话不会混入新请求。重试可能再次消耗配额，不会自动无限重试。

记录测试日期、iPhone/Expo Go 版本、模型标识及每项结果，不记录密钥。只有负责人自己的 iPhone 上完成此清单，才算真机验收通过。电脑接口成功或自动化测试成功不能代替这一步。

## 7. 排查

| 现象 | 检查方式 |
| --- | --- |
| Expo 二维码打不开 | Expo Go 与项目 SDK 是否兼容；两端是否同 Wi-Fi；Expo 终端是否仍运行；iOS 是否允许本地网络访问 |
| App 能打开但聊天连接失败 | 服务端是否启动；Safari 能否打开电脑 IP 的 3000 端口；手机端是否误填 localhost；修改地址后是否 Reload |
| 服务端未配置 | 真实密钥与模型是否在 `japan-travel/.env.local`；是否重启了服务端 |
| 密钥或模型错误 | AI Studio 中密钥、项目权限、模型标识是否匹配；不要将真实值贴进报错报告 |
| 频率或额度受限 | 等待错误提示中的时间后主动重试；检查 AI Studio 项目额度，不通过换 key 绕过项目限额，不自动付费 |
| 回复超时或暂时不可用 | 保留当前对话，稍后主动重试；检查网络和 Google 服务状态 |
| 对话太长 | 开始新对话并补充必要旅行条件；程序不会静默删除早期历史 |

双方不在同一网络时，当前局域网地址和 Expo LAN 二维码无法充当公开在线服务。远程测试方式、认证、云权限和是否产生成本需另外确认，本阶段不擅自启动公网隧道或部署。

## 8. 开发检查

```sh
# japan-travel/
npm test
npm run lint
npm run build

# japan-travel-mobile/
npm run lint
npx tsc --noEmit
```

接口格式和服务端限制见 [服务端说明](../japan-travel/README.md)，手机端配置见 [手机端说明](../japan-travel-mobile/README.md)。PR 应分别记录自动化检查、真实 Gemini 调用及 iPhone 真机测试状态，未完成的项目需明确注明。
