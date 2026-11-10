# 手机 UI 改版交接

本轮基于队友 Rean0623 的 PR #3 / feat/guided-travel-chat / cc41ae16cce1600a48b746aa5447d91ccaf77e6c，改版分支为 feat/mobile-ui-refresh。只修改手机端 UI 与交接文档，不修改云端后端、提示词、访问控制、模型或调用限额。GitHub 上传代码不会自动部署后端。

## 改动
- 发现、AI 规划、行程、设置统一白底、黑灰文字、浅灰输入区、细分割线与黑色主要按钮，采用现有组件与依赖。
- 发现页保留真实无攻略状态，搜索明确标示未开放；没有虚构攻略、点赞或用户。主要按钮跳转 AI 规划。
- AI 规划简化重复标题与欢迎文案，保留新对话、示例直接发送、真实会话、等待防重复发送、失败重试/编辑、中文输入、键盘避让、手动阅读和逐步呈现。
- 景点照片、重点高亮、预算比较、图片来源注册逻辑均保留，只统一外观。
- 行程页采用真实空状态与规划入口；原分支无行程保存能力，本轮未新增或伪造。
- 设置页为分组列表，简体中文为唯一界面语言。图片来源展开查看，作者、完整许可、裁剪说明和原始来源链接均保留。
- 底部四个入口为发现、AI 规划、行程、设置；统一 22 大小、深色选中与灰色未选中。
- AI 规划图标单独采用圆形空心 MessageCircle，带小尾巴、无背景色块。通过现有 expo-image 加载本地 SVG，没有新增原生模块或依赖。SVG 源自 Lucide，调整描边以匹配现有图标；完整许可保留在 assets/icons/LUCIDE-LICENSE。
- 蓝色齿轮属于 Expo 浮层，本次未处理。

## 队友同步与启动
在自己电脑已有的仓库中操作。先检查本地改动并保留；有改动时先提交到自己的分支或妥善保存，不要强制重置。以下命令针对没有未保存改动的工作区：

```sh
git fetch origin
git switch --track origin/feat/mobile-ui-refresh
# 如果已有同名本地分支，改用：
# git switch feat/mobile-ui-refresh
# git pull --ff-only
cd japan-travel-mobile
npm ci
```

保留现有 .env.local；首次使用时复制 .env.example 为 .env.local，并核对：

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://japan-travel-chat-930889374458.asia-northeast1.run.app
EXPO_PUBLIC_CHAT_ACCESS_MODE=shared
```

这两个值为公开配置。不要填写 Gemini 密钥，不启动本地 AI 后端，不把 localhost 当手机的云端地址。

```sh
npx expo whoami
# 必须与手机 Expo Go 使用同一个 Expo 账号；若没登录：
npx expo login --browser
npx expo start --go --lan --clear
```

手机与自己的开发电脑连同一 Wi-Fi，用相机扫描自己终端生成的二维码，在 Expo Go 打开。不要使用 Jackkie 电脑的 192.168.8.58 地址；不同电脑会有不同地址。进入 AI 规划后自动建立测试会话，无需邀请或 Gemini 会员。两位队友不必在同一网络，但各自手机仍需连通自己的 Expo 开发电脑。查看时保持开发服务运行。

现有 SDK 为 Expo 58，React Native 0.88.1；手机 Expo Go 需支持 SDK 58。本轮没有升级依赖或修改锁文件。

## 已完成检查与实际限制
- npm ci、expo install --check 完成；Expo Doctor 20/20 通过。
- 手机现有测试 72/72 通过；lint、TypeScript、git diff --check 通过。
- iOS 开发包与局域网 iOS manifest 均为 HTTP 200。
- 浏览器辅助检查四页切换、发现/行程主要按钮、设置展开收起、375×812 与 320×568 布局；320 无横向文档溢出。
- 圆形图标的导航切换、22×22 尺寸和深黑/灰色状态已在浏览器检查；修改后 iOS 包重新编译成功。
- 通过真实手机端匿名会话和聊天请求模块取得云端 Gemini 回复，没有模拟回复。
- 新版 iPhone 真机的完整 UI、键盘、长回复、图片署名链接和字体放大尚待双方反馈；不能把上述浏览器/HTTP 检查称为真机验证。
- 本地网页预览受到云端来源限制，聊天会提示连接失败；手机原生请求路径不同。本轮未为网页放开访问保护。
- Expo Go 对电脑登录账号有要求。本次扫码失败曾由隔离缓存目录未读取 Expo 登录状态导致；已恢复电脑既有登录，并用 EXPO_NO_CACHE=1 避免系统缓存写权限问题。不要为了缓存问题改 HOME，也不要提交 Expo 认证文件。
- 对话仍在页面内存，Reload/退出会清空；建议修改 UI 后点新对话测试。本轮没有新增行程保存、业务登录、支付或攻略搜索功能。

## 开发检查

```sh
npm test
npm run lint
npx tsc --noEmit
npx expo install --check
npx expo-doctor
```

如果系统 npm/Expo 缓存不可写，可使用自己电脑中可写的 npm_config_cache 目录，以及 EXPO_NO_CACHE=1；不要把 Expo 配置切到一个未登录的新目录后误判手机网络故障。CI=1 启动适合本次受限运行环境，但没有热更新，改代码后需重启；正常电脑终端直接运行 expo start 即可。
