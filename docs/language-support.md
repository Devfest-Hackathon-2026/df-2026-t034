# 中文、English、日本語

更新：2026-11-10。交付分支：`feat/places-guided-planning`。本轮将三语言支持与已有行程/票务修复一并整理交付，保留双方已有功能。

## 行为

- 第一次打开显示三种语言，用户明确选择后进入四个页面。不自动猜测语言。
- 设置 → 界面语言可以随时切换，立即更新导航、界面操作、输入提示、加载状态、错误、空状态、预算档位、清单、图片说明及无障碍标签。不重置导航或清空输入、聊天、已保存行程。
- 语言偏好独立保存在 AsyncStorage `japan-travel.language.v1`；保存成功后才发布变化，写入失败保留当前语言并提示重试。历史记录和行程的存储键、原始内容保持不变。
- `src/lib/i18n/messages.ts` 是随包发布的英文/日文界面翻译，中文原文作为消息键。`core.ts` 提供选择、格式化和参数替换；计数参数限制为数字，避免误吞日期。`components/ui.tsx` 统一处理界面文字、无障碍提示和输入占位。用户原文、AI正文、保存的方案、作者署名和许可名称通过 `raw` 保留，不调用翻译 API。
- 原有聊天/行程不会自动翻译。新回复按选定语言生成。景点日文原名仍保留，便于准确匹配图片和票务。Trip.com等外部网页使用其自身语言设置，应用不会擅自改其内容。
- 英日行程仍沿用稳定内部段落标记和原始日文地点标识，避免保存、发现、预算或照片解析失效；显示层翻译这些界面标记。英文/日文的出发城市、铁路、飞行、酒店等识别一并补充。

切换界面完全在本机进行，不消耗 Gemini token、Google Search或Places照片额度；发送聊天照常使用现有AI额度。

## 云端

- 现有项目：`gen-lang-client-0217481921`
- 现有 Cloud Run：`japan-travel-chat`，`asia-northeast1`
- 地址：`https://japan-travel-chat-14289984868.asia-northeast1.run.app`
- 语言版本构建：`931f97ac-d602-44ca-bdb6-dee9ed13c039`，SUCCESS。
- 语言版本上线修订：`japan-travel-chat-00010-4lf`，100%流量。
- `X-Travel-Language`仅接受`zh/en/ja`，未知值回退中文，不允许把任意header文本拼进模型指令。需求追问和最终生成均使用同一语言；不往聊天历史伪造用户消息。
- 更新只替换镜像。已核对运行服务账号、环境变量、指定Secret引用与更新前一致，没有增加API、IAM权限、搜索工具、充值或调用限额。

后续部署沿用 `japan-travel/deploy/cloudbuild.yaml` 和专用构建账号，只提交后端源码；构建成功后通过 `gcloud run services update ... --image=...` 更新现有服务，不用模板覆盖线上配置。语言功能不需要增加密钥。必要时可将流量退回原修订 `japan-travel-chat-00009-pgh`，但旧版不处理所选回复语言。

当前另含景点限制修复的在线版本为 `japan-travel-chat-00012-klb`；参见 [准确性修复与实际验证](accuracy-fixes-2026-11-10.md)。

## 验证与边界

- 手机端176项测试、lint、TypeScript检查；服务端68项测试、lint、TypeScript及生产构建通过。
- 浏览器375px实际查看首次选择、英语设置/导航/AI输入/错误/行程空状态、日语设置/发现，以及日语真实回复的行程总览、预算、准备和段落解析。英语重新打开后仍保留选择；日语在设置中即时切换成功。
- 为检查已保存行程样式使用的临时示例不保存数据、不调用AI/Places，最终已移除。源代码中没有保留示例路由或测试入口。
- 云端真实验证只发送2次聊天请求：英文追问名古屋旅行条件；日文返回完整Day1、JPY预算并被现有保存解析器正确解析。健康检查200。未请求照片。用手机端同一请求/会话代码调用真实服务，不是模拟回复。
- 浏览器界面预览受到现有云端跨来源保护，不能据此宣称浏览器里的AI连接已验证；以上真实AI验证使用与原生端相同的请求代码。
- 当前 Expo Go iPhone 上的首次语言选择、原生键盘、实际切换和旧记录保留仍待用户刷新新版确认，不能称为真机验收已完成。无需清除Expo Go数据。

## iPhone 验收反馈（2026-11-10）

用户用 Expo Go 刷新新版后，针对“能否看到三种语言选择、进入设置切换后四个底部页面是否更新”的验收问题明确回复：“能选择，切换也正常”。据此，首次选择、设置内切换和四入口语言更新标记为用户 iPhone 实测通过。该反馈不扩展为所有小屏幕/字号、原生键盘或全部历史记录均已逐项真机验证；英文与日文真实模型响应仍以本次两次云端测试记录为依据。

## 队友同步与启动

同步 `feat/places-guided-planning` 分支后，在 `japan-travel-mobile` 运行 `npm ci`，保留当前 `package-lock.json` 和 Expo SDK，不需要升级原生依赖。手机端 `.env.local` 只需要公开配置：

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://japan-travel-chat-14289984868.asia-northeast1.run.app
EXPO_PUBLIC_CHAT_ACCESS_MODE=shared
```

运行 `npm run start:go`，用手机 Expo Go 扫描自己电脑上的二维码。两台设备先连接同一 Wi-Fi；连接困难时使用现有 tunnel 启动方式，并确保 Expo CLI 与手机 Expo Go 登录同一账号。各位测试者可在不同网络运行各自的 Expo，连接同一个云端服务。不要复制别人的局域网 IP 或临时二维码作为永久入口。

首次选择语言；已有选择时，在设置里更改。手机端不需要 Gemini/Places 密钥，也不需要启动 `japan-travel` 本地后端。GitHub 用于同步代码，Expo Go 仍依赖各自电脑上的开发服务。


## 2026-11-10 UI 与队友交付更新

- 暖白/朱红界面、大照片旅行卡片、发现页大卡片、准备进度单入口及设置帮助/数据/版本说明见 [UI交付](warm-ui-preview-2026-11-10.md) 和 [卡片与设置](discovery-size-settings-2026-11-10.md)。名称保留「日本旅行助手」。手机端180项、服务端76项自动测试及两端类型/lint检查已通过；新版UI仍以用户后续手机实测为准。
- 发布二维码是临时开发入口。转发二维码不代表对方账号必定有权打开；Expo Go可能校验手机账号与提供预览的Expo CLI账号是否相同，且开发电脑必须持续运行。推荐队友自行启动项目。
- 队友用自己的Expo账号登录：在手机Expo Go完成登录，在电脑项目目录运行 `npx expo whoami`；如未登录，运行 `npx expo login` 完成官方登录。两端须是他自己的同一账号，不需要Jackkie密码。
- **不要设置 `EXPO_OFFLINE=1`**：SDK58离线启动时，CLI可能不读取已登录用户，造成手机提示“已登录Expo Go，但未登录Expo CLI”。联网启动并核对账号后，退出手机旧错误页、重新扫描当前电脑二维码。
- 如本地已有改动，先检查 `git status` 并保留自己的修改；不要覆盖本地 `.env.local`，不要强制重置或升级整个SDK。

自己的电脑启动示例（已在此仓库内，且当前工作区干净时）：

```sh
git fetch origin
git switch feat/places-guided-planning
git pull --ff-only origin feat/places-guided-planning
cd japan-travel-mobile
npm ci
cp .env.example .env.local
npx expo whoami
npm run start:go
```

已有 `.env.local` 时跳过复制，确认其中的公开云端地址和 shared 模式即可。同一Wi-Fi不通时可改用 `npx expo start --go --tunnel ngrok`；缺少tunnel工具时按Expo官方提示安装。每位测试者的手机与自己的开发电脑能连接即可，不必和Jackkie同一Wi-Fi。

队友不共享账号密码的完整操作与新启动入口：见 [队友独立预览](teammate-expo-preview.md)。
