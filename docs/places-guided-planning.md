# Google Places 照片与需求追问交接

基线：`feat/guided-travel-chat` / `db8c202`，开发分支：`feat/places-guided-planning`。保留最新白底黑灰 UI 和导航、景点名称、高亮、预算比较与聊天交互。当前新项目来自 DF Hack26 交接，不使用旧项目代替部署。

## 代码
- `japan-travel/src/lib/server/planning-decision.ts`：先判断追问、完整规划或局部回答；读取全对话，最多3问，不重复用户已给条件。同一条追问询问尚缺的天数、人均预算与特别想去的景点，不标注“可选”；用户下一轮未回答景点或说没有，则自行推荐并规划，不反复追问。用户授权代定时传入简短假设。信息足够直接进入完整生成，不增加确认轮。
- `gemini.ts`：一次有20秒/2048输出token上限、无重试的结构化判断；Gemini 3.8 Flash 用官方支持的 LOW 思考级别，未使用不支持的 MINIMAL。完整规划复用现有结构化分段，先固定路线概述，再有界并行生成其余段落，按日期合成同一条全程回复，最多31天。判断与生成共享进程级最多2个实际 SDK 调用的调度器，队列也有上限；取消时要等实际 SDK 工作结束才释放名额。判断与生成共享一次持久化 admission；所有 provider token 用量累加，最多一次判断加原有受限生成/修复调用。
- `chat.ts`：简短补充“14天”也根据历史规划14天，仍校验完整日期；局部回答不强制套行程。未授权代定时，缺重要天数/路线信息先问，不再使用京都三天默认模板（生产路由始终接入判断器）。
- `/api/place-photos`：按日文景点名和城市查 Places Text Search (New)，校验日本地址、地点名、城市和唯一结果，再选择足够清晰的横图，通过 Place Photos 获取不带密钥的照片 URI。最多每批4处，不重试，不接受客户端 URL/密钥/模型。Google 照片名不缓存、不持久化。
- 真实外观和清晰度优先人工验收：Places 元数据只有尺寸与作者等信息，不能保证每张一定是可辨认的外景。代码不会声称已做图像内容识别；如返回室内、局部或错主体，在发布前按验收步骤阻止该选图上线。
- `shared-access.ts`：复用现有匿名/邀请会话验证，用独立 UTC 日事务计数限制所有 Places 外部请求（Search 与 Photo 各计一次，失败也计）；不占用 Gemini 的100/20次生成限额。总量100、每会话80（2026-11-08负责人明确批准由40调至80，总量不变），跨实例/重复会话不能重置总量。
- 手机 `google-place-photos.ts` 与 `google-photo-client.ts`：从每天标题/路线概览提取城市证据，每天最多4处；没有城市证据就跳过，不猜同名景点。按阅读顺序按需查询，只在界面使用 Google 内容，不写入磁盘或旧 Wikimedia 缓存。网络/服务/额度错误停止该回复余下查询，文字继续显示。
- 已核实的歧义修正：高尾山上下文中的“薬王院”用官方全名“高尾山薬王院”和八王子市查询；没有上下文则跳过，服务端也拒绝简称的宽泛查询，避免取到新宿同名寺院。
- 手机AI回复新增“复制全文”，一次复制原始完整文字（全部天数和三档预算），仅用户点击时写剪贴板，不读取已有剪贴板。
- `json-transport.ts`：聊天、匿名会话和Google照片共用React Native原生XHR文本接收，避免JSON经过Blob/FileReader路径。保留调用者取消、8/15/105秒期限和HTTP错误语义，不自动重发POST。仅记录不含正文/令牌的错误元数据。此前全局fetch开关对照后仍复现失败，不能称它已修复；新接收方式已获用户首次成功及照片显示反馈。无需给手机新增配置或凭据。
- 达到持久化照片限额时显示“本次测试的图片额度已用完，文字行程仍可查看”；不重置计数、不自动领取新会话来规避限制。
- 预算表默认JPY（日元），包括从中国出发的行程；用户人民币预算约束用明确参考换算假设估算JPY，只有明确要求其他显示币种才切换，不冒称实时汇率。旧消息不重贴货币标签。
- `google-place-photo-card.tsx`：横图下方显示 Google Maps、全部作者及可用链接，并提供应用条款/隐私入口。图片缓存关闭。Google 查询关闭或旧后端404时，兼容保留原 Wikimedia 通道；Google 开启后无匹配则省略该图。
- `/legal/terms`、`/legal/privacy`：准备了公开的测试条款和隐私说明，须负责人审阅后随部署发布，不是网页聊天界面。Google 政策要求应用公开条款与隐私说明；会话失效不等于数据库记录立即删除。

## 本地检查（2026-11-08）
- 后端65项、手机95项测试通过；新增追问/完整14天/授权假设/局部回答/生成修复，以及城市重名、错误图片地址、署名、持久化竞争限额等覆盖。
- 两端 lint 与 TypeScript、后端生产构建通过。生产 standalone smoke 已通过（含照片接口无会话401、错误Host403和条款/隐私200）。iOS 开发包 HTTP 200，手机配置已核对为新项目公开 HTTPS 地址；这不是新版功能的真机验收。
- 测试 provider 响应仅用于自动化测试，不在 App 中返回伪造 Gemini 或 Google 数据。
- 负责人已完成指定维护权限与 Places 初始化；Jackkie 已用自己的账号部署。Secret 固定引用 `travel-places-api-key:1`，没有读取或交换密钥。实际 Google 调用匹配清水寺（京都）和東京タワー（東京），不存在的景点返回空照片；照片主体和手机展示仍须真机核对。
- 首次云端14天测试实际触发95秒超时，随后修复分段串行耗时、限制实际并发并降低完整生成的思考开销。修复版的真实生成结果与 Expo Go 结果在下方发布记录中记录，不用单元测试代替。

## 聊天历史与追问跟进（2026-11-08）
- 原12秒需求判断曾在日志中出现GEMINI_TIMEOUT，未开始行程生成。判断期限改为20秒，整段95秒、云端110秒、并发和调用限制不变；日志补充判断/生成阶段和失败时判断耗时，不记录聊天正文。放宽这一阶段期限不能保证永不超时。
- 新增7项本机历史测试：保存/重开、独立记录、草稿/中断请求、过滤秘密与照片字段、并发写入、写失败恢复、损坏数据保护、容量和清空草稿。手机95项及后端65项全通过，两端lint/TypeScript通过。
- 355px浏览器预览已检查居中标题、左上历史入口、侧栏/空状态；新历史的Expo Go真机恢复/删除仍待用户验证。浏览器预览不代替原生手机验证。
- 按用户要求，没有再次真实调用Gemini复测名古屋追问；三项追问及景点未答后的行为已更新提示词与结构校验，实际模型行为仍待后续观察。

## 当前发布与实测记录（2026-11-08）
- 运行源码 `90105d5`，Cloud Build `2d44e203-639f-4630-874e-c0a13cc76518` SUCCESS；东京服务 `japan-travel-chat-00009-pgh`，100%流量。
- 镜像 `sha256:5007fbbe28a631f064ba5cfa35ef741182a22baad7b358fbb6180b663b699963`；Secret固定 `travel-places-api-key:1`，照片开启。保留原运行身份、实例/并发与110秒服务超时，聊天整体95秒。照片限额100/UTC日、80/会话；Gemini生成100/日、20/会话以及匿名签发限额未变，没有清空计数。
- 云端健康200。真实照片接口缺会话401。城市匹配修复版`00007-t2b`逐处通过：清水寺/京都（`ChIJB_vchdMIAWARujTEUIZlr2I`）、東京タワー/東京（`ChIJCewJkL2LGGAR3Qmk0vCTGkg`）、高尾山薬王院/八王子（`ChIJW2Uqt30ZGWARl6_BIetZBAw`）均有Google照片及署名，无匹配空照片。`00008`照片实现相同，用户确认药王院照片已显示。
- 最新云端真实测试：从中国出发、不指定预算表币种，返回完整两天及`币种｜JPY`。本地报告只保存测试文字与状态，权限600，不含会话凭据或Google照片URL/资源名。
- Expo Go由用户操作：缺条件时只追问天数；之后完整Day1–14，保留三人、人均1万人民币预算约束与大阪/京都/东京/北海道。全文复制和图片链接打开已确认。14天真机成功在新XHR接收方式上线前；最新XHR版本已确认首次收到完整一日回复，随后在80次限额下确认照片显示、预算JPY；尚未再做最新版14天真机复测。
- 用户截图已看到横图、Google Maps、作者及政策入口；无图时文字、小结、预算完整。最终修复后的药王院照片用户只作文字确认，尚无最终截图供本助手核对主体，不能声称逐张外景均人工验收。全部作者/条款链接没有逐一点击。
- 额度实测：旧手机会话提示图片额度用完，同时新测试会话仍能查询，表明不是全局总量耗尽；负责人批准仅将会话40调到80，全局100不变。之后用户确认无额度提示、照片正常。没有将此软件限制说成Google账号免费余额耗尽。
- 故障记录：首次14天95秒超时，修复LOW思考/有界并行；一次Vertex429明确失败，无无限重试。后续真实HTTP14天成功约57.6秒（含一次受限修复）。旧图片测试曾仅检查至少一处成功而漏掉京都缺图，现已逐处断言。城市/区级地址与同名寺院误配已补回归覆盖。
- 已知内容限制：真实14天回复在分段边界重复了部分景点，住宿/转场描述也需校对。完整性校验不等于旅行事实核验；没有Google联网搜索核验票价、营业和班次，不能把估价或模型建议称为已核实。偶发网络失败需继续观察，不凭单次成功宣布根治。
- iPhone镜像自动输入不可用，真机证据来自用户回复和截图；HTTP与单元测试独立记录，不冒充真机测试。本轮新增功能只由当前这台iPhone确认，队友不同网络手机未重新实测；具体手机型号和Expo Go版本号未采集。

## 当前项目与配置
- Google Cloud：`gen-lang-client-0217481921`，项目编号 `14289984868`。
- 现有服务 `japan-travel-chat`，区域 `asia-northeast1`。
- API `https://japan-travel-chat-14289984868.asia-northeast1.run.app`。
- Vertex 模型沿用项目当前可用配置；交接为 `gemini-3.8-flash` / `global`。不创建新项目，不替换为旧额度项目。
- 负责人先核对结算账号、国家/地区（如 EEA 则重新核对对应条款）、Maps 免费额度、试用赠金实际适用范围；不能用 Gemini 会员或 Cloud 试用赠金的存在推断 Maps 免费。
- 负责人已批准并完成 Places API (New) `places.googleapis.com`、API Keys/Secret Manager 初始化，服务只引用专用 `travel-places-api-key` 的版本 `1`。个人维护账号不获密钥读取权；运行账号读取指定 Secret，构建账号不读取。
- Cloud Run 动态出口不能简单套手机或浏览器 referrer 限制；先限制 API、限制密钥接触范围、持久化请求总量，再由负责人评估是否需要固定出口 IP。不要因限制错误把 key 放进手机。
- 已核对新项目已有默认 Firestore：STANDARD / FIRESTORE_NATIVE / asia-northeast1；线上匿名会话和照片限额真实事务可用。此改动复用同一 Node Firestore 事务适配层，没有创建数据库或修改规则。

官方价格核对日2026-11-08：[Maps 全球价目](https://developers.google.com/maps/billing-and-pricing/pricing)。Text Search Pro 免费使用上限5000/月、超出后首档 US$32/千次；Place Details Photos 免费上限1000/月、超出后 US$7/千次。实际按结算账号聚合，免费余额和赠金尚未读取。每张图通常一搜一取，超过免费时约 US$0.039；100次外部请求/日的保守上限按最贵 Search 全部计约 US$3.20/日，另有既存 Gemini、Firestore、Cloud Run 等费用。该请求限额不是整个云项目的账单封顶，API 外部使用和其他服务另计。

Google 要求参考：[Place Photos](https://developers.google.com/maps/documentation/places/web-service/place-photos)、[Places 政策](https://developers.google.com/maps/documentation/places/web-service/policies)。展示作者、Google Maps，不能保存照片名或批量抓取。照片查询与生成模型的图片参考功能分开实现，不将 Google 照片重新喂给 Gemini 做内容识别。

## 维护权限与凭据
由新项目负责人一次性授权 Jackkie 自己的 Google 账号；不要给 Owner/Editor，不交换密码或服务账号 JSON。需要：指定 Cloud Run 服务读/更新、提交/读取 Cloud Build、指定源码暂存桶读/创建、指定镜像仓库读取、对 travel-chat-build 与 travel-chat-runtime 两个账号 actAs、该服务和构建的过滤日志查看。已有 [旧项目的权限交接](jo-cloud-deploy-handoff.md) 只作权限设计参考，不能直接执行旧项目命令。

已提供 `japan-travel/scripts/grant-release-maintainer.py`：默认仅打印计划，`--apply` 才执行；固定新项目，保留其他绑定，不覆盖已存在的不同自定义角色。负责人先审阅再在自己的官方 gcloud 会话中执行，例如 `python3 japan-travel/scripts/grant-release-maintainer.py --member user:ACCOUNT_EMAIL`。确认账号与范围后才追加 `--apply`；实际账号由私下沟通提供，不在文档中填个人邮箱。若自定义角色刚创建尚未传播，等待后核对并重跑；不得转用 Owner/Editor。

权限包含部署指定运行身份，所以维护者可以通过自己发布的服务代码使用该运行身份的数据库/Vertex/指定 secret 权限，不是仅能改提示词的权限。脚本不授予个人 Secret 读取、API Keys 管理、计费管理或服务开启权限；也不启用 Places、不创建凭据、不部署。

Places 初始启用、受限 key 与 Secret 创建/授权可由负责人以官方 Cloud Console 会话协助完成；这些不应变成 Jackkie 对全项目密钥的永久管理权。镜像部署不需要把 Maps key 交给维护者。只向运行账号授予指定 secret 的 `secretmanager.secretAccessor`，Cloud Build 不接触这个 secret。

## 部署（获得批准和维护权限后执行）
先在仓库根目录核对本地修改已提交、工作分支和版本。不要直接使用模板覆盖当前运行配置。

```sh
gcloud auth list
gcloud config set project gen-lang-client-0217481921
gcloud run services describe japan-travel-chat --region=asia-northeast1 --format='value(status.latestReadyRevisionName,status.url)'
gcloud firestore databases describe --database='(default)' --format='value(databaseEdition,type,locationId)'
gcloud services list --enabled --filter='name:places.googleapis.com' --format='value(name)'
```

以下启用与 Secret 操作只在批准后由有相应权限的负责人执行：

```sh
gcloud services enable places.googleapis.com --project=gen-lang-client-0217481921
# 用 Google 官方 API Keys 管理页创建/限制 key（仅 Places API New），不要打印或粘贴到聊天。
# 私下将 key 写入权限600的临时文件；由授权操作将文件加入 Secret Manager，然后删除临时文件。
gcloud secrets create travel-places-api-key --replication-policy=automatic --project=gen-lang-client-0217481921
# 如已存在，跳过 create 并核对它确实为专用 secret。
gcloud secrets versions add travel-places-api-key --data-file=PRIVATE_KEY_FILE --project=gen-lang-client-0217481921
gcloud secrets add-iam-policy-binding travel-places-api-key --project=gen-lang-client-0217481921 --member='serviceAccount:travel-chat-runtime@gen-lang-client-0217481921.iam.gserviceaccount.com' --role=roles/secretmanager.secretAccessor
```

代码镜像使用现有 build 配置、专用构建账号和固定镜像摘要：

```sh
places_sha="$(git rev-parse --short=12 HEAD)"
places_tmp="$(mktemp -d)"
places_image="asia-northeast1-docker.pkg.dev/gen-lang-client-0217481921/travel-chat/api:$places_sha"
git archive --format=tar.gz --output="$places_tmp/server.tar.gz" HEAD:japan-travel
places_build="$(gcloud builds submit "$places_tmp/server.tar.gz" --project=gen-lang-client-0217481921 --region=asia-northeast1 --config=japan-travel/deploy/cloudbuild.yaml --substitutions="_IMAGE=$places_image" --service-account=projects/gen-lang-client-0217481921/serviceAccounts/travel-chat-build@gen-lang-client-0217481921.iam.gserviceaccount.com --gcs-source-staging-dir=gs://gen-lang-client-0217481921-travel-build/source --suppress-logs --quiet --format='value(id)')"
gcloud builds describe "$places_build" --region=asia-northeast1 --project=gen-lang-client-0217481921 --format='value(status)'
# 必须为 SUCCESS 才继续。
places_digest="$(gcloud builds describe "$places_build" --region=asia-northeast1 --project=gen-lang-client-0217481921 --format='value(results.images[0].digest)')"
[[ "$places_digest" =~ ^sha256:[0-9a-f]{64}$ ]] || exit 1
# 先记录当前镜像和运行配置供回退；不得输出密钥值。
gcloud run services update japan-travel-chat --project=gen-lang-client-0217481921 --region=asia-northeast1 --image="asia-northeast1-docker.pkg.dev/gen-lang-client-0217481921/travel-chat/api@$places_digest"
```

后续只换镜像即可保留当前照片开关与 Secret。需要显式恢复已批准的配置时：

```sh
# 固定已批准的版本1，避免无声切换 latest。
gcloud run services update japan-travel-chat --project=gen-lang-client-0217481921 --region=asia-northeast1 --update-secrets='GOOGLE_PLACES_API_KEY=travel-places-api-key:1' --update-env-vars='PLACES_PHOTOS_ENABLED=true,PLACES_DAILY_REQUEST_LIMIT=100,PLACES_SESSION_DAILY_REQUEST_LIMIT=80,PLACES_TERMS_URL=https://japan-travel-chat-14289984868.asia-northeast1.run.app/legal/terms,PLACES_PRIVACY_URL=https://japan-travel-chat-14289984868.asia-northeast1.run.app/legal/privacy'
```

保留现有 shared、匿名开关、100/20/100生成及签发限额、运行服务账号、并发/实例上限和模型。请求超时应覆盖现有95秒整段生成期限；核对当前服务实际值，不未经批准扩大资源。

## 真实 HTTP + Expo Go 验收

`japan-travel/scripts/verify-guided-places.mjs` 只针对明确提供的 HTTPS 地址真实调用，不模拟。最多2次 Gemini 对话请求、3处真实景点查询及1处无匹配查询；判断/分段生成会产生额外模型内部调用。支持 `--chat-only` 或 `--photos-only` 分开复测，避免不必要的重复调用。报告用600权限，不写会话令牌、Google图片资源名/URL或密钥；照片部分只记录允许长期保留的 Place ID 和简短通过状态。

```sh
node japan-travel/scripts/verify-guided-places.mjs https://japan-travel-chat-14289984868.asia-northeast1.run.app /PRIVATE_PATH/guided-places-live.json
```

手机 `.env.local` 公开配置（不含密钥）：

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://japan-travel-chat-14289984868.asia-northeast1.run.app
EXPO_PUBLIC_CHAT_ACCESS_MODE=shared
```

新版聊天历史保存在当前设备的 AsyncStorage（非加密存储），不上传到云端或同步其他设备。AI规划标题居中，左上角打开历史，可恢复/切换/删除记录，继续原对话；草稿自动保存，未完成请求恢复后需手动重试，不自动重发。最多20段、总计1.5 MB，满额提示手动删除，不静默清空旧记录。历史不保存凭据或Google照片资源/URL；恢复时先显示全文，用户点“加载景点照片”才重新查询，照常计入照片额度。安装新版前已丢失的聊天无法恢复。当前Mac保留8085旧预览和8086新版。

队友在自己电脑先保留未提交改动，再同步分支（发生分歧停下检查，不强制重置）：

```sh
git fetch origin
git switch feat/places-guided-planning
git pull --ff-only origin feat/places-guided-planning
cd japan-travel-mobile
npm ci
# 已有.env.local时核对上面的两行，保留其他有效配置，不直接覆盖。
# 没有该文件时复制.env.example为.env.local。
npx expo whoami
npx expo start --go --lan --clear
```

手机与自己的Expo电脑连同一Wi-Fi，用自己的Expo账号打开扫码；两位用户不必在同一网络，无需启动本地AI后端或填写Gemini密钥。GitHub不托管Expo开发服务。最新JSON接收不依赖全局`EXPO_PUBLIC_USE_RN_FETCH`诊断开关；早期本机曾保留该值，并不需要队友添加。

手机扫码，用同一对话验证：
1. 发“从新疆出发，三个人去大阪、京都、东京和北海道，预算不多”：同一条回复询问尚缺的天数、人均预算与特别想去的景点，最多3项，不擅自生成三天、不重复三个人。
2. 接着发“14天，每人预算1万人民币，包含来回交通、住宿和餐饮。路线顺序您按省钱省心决定，喜欢动漫、美食和自然，直接生成完整行程”：同一条回复 Day1–14 连续，概述、每天图文、单列顺序活动、小结、三档预算；不要多一次确认或让用户发继续。
3. 新对话发“东京三天，两个人，人均5万日元，喜欢动漫和美食，直接规划”：信息足够，直接给三天。再检查京都清水寺、东京塔、札幌円山公園等照片的真实主体和城市，横图在对应介绍下，每天最多4张。作者/地图/条款链接可打开。
4. 无匹配与断网/额度用完时仍能读完整文字，不留空图片卡，不自动无限重试；恢复网络后新对话按需重新查询。

记录手机型号、Expo Go版本、网络、时间、服务修订版及真实回复/截图。没有实际手机证据的情况只标为未实测。测试报告中的模型行为必须人工复核，自动 Day计数不能证明所有路线/预算事实正确。

## 关闭和回退

```sh
gcloud run services update japan-travel-chat --project=gen-lang-client-0217481921 --region=asia-northeast1 --update-env-vars='PLACES_PHOTOS_ENABLED=false'
```

关闭后新查询使用原 Wikimedia 通道；已展示的照片仅留当前界面，退出即可清空。回退聊天逻辑用发布前记录的镜像摘要更新该服务；保留先前资源/权限，不删除 Firestore 数据。无需运行新照片功能时可撤销运行账号对专用 secret 的读取，或在负责人确认后禁用专用 key/API。不会因为关闭 flag 自动删除云资源或停止其他服务费用。

## Gemini搜图与Places的范围
当前继续使用Places，Gemini联网搜索/图片搜索均未启用。100/80是应用自己的保护上限，不是Google官方免费额度。负责人在比较后明确选择保留Places。

Google Cloud的Search Grounding有每月5000次免费查询池，超出按查询计费，模型调用另计；Gemini图片搜索是支持图片模型的检索参考功能，不能将免费查询次数直接等同为可显示的景点照片数量。参考[Grounding功能](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/grounding/grounding-with-google-search)和[Cloud模型价格](https://cloud.google.com/model-garden/pricing)。切换方案须另做模型、费用、来源展示和真机验证，当前交付不暗中切换。
