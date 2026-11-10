# ジョ这边的 Codex：提示词维护与现有 Cloud Run 部署

2026-11-06。继续使用本项目和已有服务；不新建项目、服务、结算或服务账号。本文件不包含密钥、密码、个人 OAuth 凭据或服务账号文件。

## 固定资源与代码

| 项目 | 当前值 |
| --- | --- |
| Google Cloud 项目 | `gen-lang-client-0997218352` |
| Cloud Run | `japan-travel-chat`，`asia-northeast1`（东京） |
| 手机 API | `https://japan-travel-chat-930889374458.asia-northeast1.run.app` |
| GitHub | `https://github.com/Rean0623/japan-travel-ai` |
| 当前完整分支 | `feat/shared-gemini-service`，PR #2；保存双方已有修改 |
| 提示词 | `japan-travel/src/lib/server/chat.ts`，`TRAVEL_SYSTEM_INSTRUCTION`（当前第 13 行起） |
| 提示词调用点 | `japan-travel/src/lib/server/gemini.ts`，`config.systemInstruction` |
| 构建配置 | `japan-travel/deploy/cloudbuild.yaml` |
| Dockerfile | `japan-travel/Dockerfile`；Node 22，Next standalone |
| 镜像仓库 | `asia-northeast1-docker.pkg.dev/gen-lang-client-0997218352/travel-chat/api` |
| 源码桶 | `gs://gen-lang-client-0997218352-travel-build/source` |
| 构建身份 | `travel-chat-build@gen-lang-client-0997218352.iam.gserviceaccount.com` |
| 运行身份 | `travel-chat-runtime@gen-lang-client-0997218352.iam.gserviceaccount.com` |
| 模型接入 | Vertex / `gemini-3.1-flash-lite` / `global`，使用运行身份 ADC |

修改手机文案不会修改系统提示词。GitHub 推送也不会自动更新 Cloud Run；需要按下述流程构建和更新镜像。服务 URL 保持不变，纯服务端提示词更新通常无需改手机配置；建议手机开新对话验证新行为。

## 已配置的维护权限

已向指定的乔本人 Google 账号写入并回读核对 8 项资源绑定：

| 范围 | 角色/能力 |
| --- | --- |
| 项目 | 自定义 `travelChatBuildSubmitter`：构建提交、读取/取消、构建/部署操作状态、项目读取和使用已启用 API |
| 仅东京现有 japan-travel-chat | 自定义 `travelChatServiceUpdater`：读取、更新服务及读取相关 revision/configuration/route；不含服务新建、删除或 IAM 修改 |
| 仅指定源码桶 | 自定义 `travelChatSourcePublisher`：桶元数据、对象创建/读取/列举；不含删除、改 IAM 或新建桶 |
| 仅东京 travel-chat 镜像仓库 | `roles/artifactregistry.reader`；推送由既有构建身份执行 |
| 指定构建身份、运行身份（各一项） | `roles/iam.serviceAccountUser`，允许构建/部署时 actAs，不分发账号文件 |
| 仅运行日志视图 | `_Default` / `global` / `japan-travel-chat-runtime` 的 `roles/logging.viewAccessor` |
| 仅构建日志视图 | `_Default` / `global` / `japan-travel-chat-builds` 的 `roles/logging.viewAccessor` |

运行日志视图只包括东京 `japan-travel-chat` 的 `cloud_run_revision`；构建视图包括本项目 Cloud Build 日志。Cloud Build API 的提交/元数据权限是项目级；流程固定使用东京和指定构建账号。没有授予 Owner/Editor、IAM 管理、充值/升级、API 启用、Secret 读取、服务账号密钥创建或 Token Creator。

部署权可以改变该服务的代码行为和用量，不是只允许改一个字符串。继续保留已确认的日总量/会话限额及匿名开关，不自行提高额度或新增资源/权限。

权限绑定已由当前管理员回读确认，两个过滤日志视图也已读取验证。**尚未以乔账号实际登录或提交构建**；该账号的首次自检需由乔这边 Codex 使用本人登录完成。IAM 新授权可能需要传播，403 时先核对账号、项目及具体缺少权限，不自动升级到 Owner/Editor。

## 本人登录与只读自检

安装官方 Google Cloud CLI、Git、兼容的 Node.js LTS（项目检查需要 22.18+）。只用本人 Google 账号登录，不复用 Jackkie 的登录目录、ADC 或密码。Google Cloud 权限与 GitHub 仓库权限是两套系统。

```sh
gcloud auth login
gcloud auth list --filter=status:ACTIVE --format='value(account)'
gcloud config set project gen-lang-client-0997218352

gcloud projects describe gen-lang-client-0997218352 --format='value(projectId)'
gcloud run services describe japan-travel-chat --project=gen-lang-client-0997218352 --region=asia-northeast1 --format='value(status.latestReadyRevisionName)'
gcloud builds list --project=gen-lang-client-0997218352 --region=asia-northeast1 --limit=1
gcloud artifacts docker images list asia-northeast1-docker.pkg.dev/gen-lang-client-0997218352/travel-chat/api --limit=1
gcloud storage ls gs://gen-lang-client-0997218352-travel-build/source/
```

读日志必须指定获准视图，不使用整个项目默认日志范围：

```sh
gcloud logging read '' --project=gen-lang-client-0997218352 --bucket=_Default --location=global --view=japan-travel-chat-runtime --limit=10
gcloud logging read '' --project=gen-lang-client-0997218352 --bucket=_Default --location=global --view=japan-travel-chat-builds --limit=10
```

不需要 Gemini API 密钥，不需要 `gcloud auth application-default login` 或下载服务账号文件。仅部署不直接以个人身份调用 Vertex/Firestore。

## 修改与本地检查

先 `git status`、保存自己的工作、`git fetch origin`，从完整分支同步 `git pull --ff-only`；不要 reset、强推或覆盖 Jackkie 的改动。先读目录内 `AGENTS.md`，只修改本次需要的提示词。

在 `japan-travel`：

```sh
npm ci
npm test
npm run lint
npm run build
```

检查完整多轮历史、输入/输出长度、限额、超时、匿名会话与错误处理未被改动；保留未核实票价/营业信息不能声称实时确认、没有保存/预订/支付等边界。日志不要新增对话正文、API 密钥或会话凭据。

检查 diff 后提交提示词修改到 Git，并同步团队分支/PR。下面只构建已提交服务端，未提交的提示词不会被归档。

## 现有构建与部署命令

以下为 Bash（macOS/Linux 或 Git Bash）；Windows PowerShell 由 Codex转换变量与续行语法，固定资源不变。每一步失败即停止，不把 QUEUED/WORKING 当成功。

从仓库根目录执行：

```sh
clouddeploy_sha="$(git rev-parse --short=12 HEAD)"
clouddeploy_tmp="$(mktemp -d)"
clouddeploy_image="asia-northeast1-docker.pkg.dev/gen-lang-client-0997218352/travel-chat/api:$clouddeploy_sha"
git archive --format=tar.gz --output="$clouddeploy_tmp/server.tar.gz" HEAD:japan-travel
```

上传前检查归档不含实际 `.env.local` / `.env.shared.local`、私钥或 ADC；`.env.example` 的空示例可以包含。不要改成直接上传整个工作目录。

```sh
clouddeploy_build_id="$(gcloud builds submit "$clouddeploy_tmp/server.tar.gz" \
  --project=gen-lang-client-0997218352 --region=asia-northeast1 \
  --config=japan-travel/deploy/cloudbuild.yaml \
  --substitutions="_IMAGE=$clouddeploy_image" \
  --service-account=projects/gen-lang-client-0997218352/serviceAccounts/travel-chat-build@gen-lang-client-0997218352.iam.gserviceaccount.com \
  --gcs-source-staging-dir=gs://gen-lang-client-0997218352-travel-build/source \
  --suppress-logs --quiet --format='value(id)')"

gcloud builds describe "$clouddeploy_build_id" --project=gen-lang-client-0997218352 --region=asia-northeast1 --format='value(status)'
```

`--suppress-logs` 保留构建等待，但不尝试读取整个项目默认日志。出错时通过上面获准的构建日志视图排查。确认状态为 `SUCCESS` 再取 digest：

```sh
clouddeploy_digest="$(gcloud builds describe "$clouddeploy_build_id" --project=gen-lang-client-0997218352 --region=asia-northeast1 --format='value(results.images[0].digest)')"
[[ "$clouddeploy_digest" =~ ^sha256:[0-9a-f]{64}$ ]] || exit 1

gcloud run services update japan-travel-chat \
  --project=gen-lang-client-0997218352 --region=asia-northeast1 \
  --image="asia-northeast1-docker.pkg.dev/gen-lang-client-0997218352/travel-chat/api@$clouddeploy_digest"
```

这里只更新已有服务的镜像，保留当前环境、运行身份、限额、匿名开关与 IAM。不要添加 `--allow-unauthenticated`，不要新建同名服务，也不要直接用默认匿名关闭的模板覆盖现有配置。Google Cloud 会创建新 revision，这是现有服务的正常更新。

## 上线验证与回滚

```sh
gcloud run services describe japan-travel-chat --project=gen-lang-client-0997218352 --region=asia-northeast1 --format='yaml(status.latestCreatedRevisionName,status.latestReadyRevisionName,status.conditions)'
curl --fail --silent --show-error https://japan-travel-chat-930889374458.asia-northeast1.run.app
node japan-travel/scripts/verify-shared-cloud.mjs https://japan-travel-chat-930889374458.asia-northeast1.run.app /PRIVATE/PATH/prompt-cloud-report.json
```

报告路径用本机私有目录。最后一条会签发两个匿名会话并进行 6 次真实 Gemini 生成，计入服务端日限额；无邀请、无 Gemini 密钥。报告包含测试对话，不包含会话令牌，不提交报告到 GitHub。

还要用与提示词改动对应的实际请求验证新行为，并让手机开新对话确认。检查 Ready、新镜像 digest、真实回复与日志；不能只凭 build 成功就说已上线。记录源码提交、build ID、digest、revision、真实/未测项目。

部署前先记录旧镜像 URI。需要回滚时，用同样 `gcloud run services update ... --image=旧的完整digest镜像URI`，保留原配置并重新验证。不要删除服务、镜像仓库或数据库。

截至本次交接，已在线的基准镜像为 `asia-northeast1-docker.pkg.dev/gen-lang-client-0997218352/travel-chat/api@sha256:b016b11adef737a927f33d68c930ed493b46fbbaaa49142272e1c162c2ad3470`，源码 `4f5cf99`、revision `japan-travel-chat-00007-9mc`；以后以实际服务查询为准。

更多费用、开关与停用边界见 [云端手册](cloud-run-deployment.md)。当前部署使用团队 Cloud 项目及运行身份，不消耗个人 Gemini 会员聊天额度。

## 可直接交给乔这边 Codex 的任务

> 先阅读本文件与项目 AGENTS.md，用本人已获授权的 Google 账号执行只读自检；继续使用现有项目 gen-lang-client-0997218352、东京服务 japan-travel-chat、指定构建/运行身份。同步完整 feat/shared-gemini-service，保留双方修改。按我的具体需求修改 japan-travel/src/lib/server/chat.ts 的 TRAVEL_SYSTEM_INSTRUCTION，检查、提交并构建已提交服务端，以 digest 只更新已有服务镜像。验证 Ready 和真实匿名 Gemini 回复，再同步 GitHub 与部署记录。不要索取 Gemini 密钥、复制别人的凭据、创建新项目/服务、扩大 IAM 或自行充值升级。若出现缺权限，提供具体 permission/resource/操作，不用 Owner/Editor 兜底。

参考：[Cloud Run 部署权限](https://docs.cloud.google.com/run/docs/reference/iam/roles)、[Cloud Build 权限](https://docs.cloud.google.com/build/docs/securing-builds/configure-access-to-resources)、[自定义构建身份](https://docs.cloud.google.com/build/docs/securing-builds/configure-user-specified-service-accounts)、[过滤日志视图](https://docs.cloud.google.com/logging/docs/logs-views)。
