# 行程准确性与预订入口修复 · 2026-11-10

基于 `feat/places-guided-planning` 的 `7b8c17f`，预览验收后按用户要求整理为本次 GitHub 交付。

## AI 条件

- 从用户消息提取明确的“只去／only visit／だけ”与排除景点条件；助手建议不能成为用户条件。
- 短句补充保留限制；明确修改、解除及指定 Day 的限制按新要求处理。
- 限制写入生成指令，并检查每天景点标题及活动中已识别的地点。交通、餐饮、景点内休息可以安排；不能借周边休息增加别的公园或河岸。
- 沿用已有一次修正机会；仍违反限制时返回独立错误和中英日提示，不返回错误方案，不无限重试。
- 校验属于有边界的保护：未覆盖所有自然语言、景点别名及预算可行性，不能保证任何输入都百分之百正确。默认调用次数、全局／单会话限额和超时不变；触发修正会增加一次模型调用。

## 门票与入口

新增七个有官方依据的免费普通参观范围：上野公园、代々木公园、五稜郭公园、大濠公园、大阪城公园、札幌円山公园、伏见稻荷大社。免费范围不扩展到动物园、博物馆、天守阁、庭园、游船、特殊活动或套票。

- 准备建议不再把这些普通免费参观当成买票任务。旧清单只调整显示分类，保留日期、已勾选状态和原数据。
- 已核实的上野／円山动物园连接官方入园说明。
- Hunter Mountain Shiobara 雪票与雪具租赁分别连接官方 ticket／rental 页面；仅匹配那须盐原及已知宇都宫出发的当天行程，不匹配纽约同名雪场。
- 括号必须是同一地点的等价译名，不能把不同设施或混合产品当成准确匹配。
- 这不是 Trip.com 合作库存接口。官方说明页不预填日期、人数；未收录项目仍明确显示未匹配，不伪造余票、价格、订单或景点地址。

本地资料与入口判断不消耗 Gemini 或 Places 请求。新增字段及提示附带英文、日文翻译。

## 资料来源

核对日：2026-11-10。代码中的 `sources`、`scope`、`note` 保留依据及免费边界，不存固定票价。

- [台东区 · 上野公园](https://www.culture.city.taito.lg.jp/zh-tw/facilities/00001c0000000000000200000054007f)
- [东京都公园协会 · 代々木公园](https://www.tokyo-park.or.jp/park/yoyogi/index.html)
- [函馆官方旅游 · 五稜郭公园](https://www.hakobura.jp/spots/555)
- [福冈县 · 公园设施](https://www.pref.fukuoka.lg.jp/contents/kenkoen3.html)
- [大阪观光局 · 大阪城公园](https://osaka-info.jp/spot/osaka-castle-park/)
- [北海道政府 · 札幌円山公园](https://www.pref.hokkaido.lg.jp/kn/tkn/hana/place/c040.html)
- [京都府观光联盟 · 伏见稻荷大社](https://www.kyoto-kankou.or.jp/info_search/323)
- [上野动物园官方入园说明](https://www.tokyo-zoo.net/ueno/visitor-info/tickets/index.html)
- [札幌円山动物园官方入园说明](https://www.city.sapporo.jp/zoo/info/riyo/kaienjikan.html)
- [Hunter Mountain 官方雪票](https://www.hunter.co.jp/winter/ticket/)／[租赁](https://www.hunter.co.jp/winter/rental/)

## 验证

- 手机端 180 项、服务端 76 项测试通过；两端类型与 lint 检查通过。
- 375 × 812 浏览器预览检查真实卡片组件与按钮目标。临时样例、查询开关已删除，不保存到用户数据。
- Expo Go iOS manifest 与完整 bundle 均返回 200；保持原作用域，包含新提示，无测试样例及 Google API Key 格式内容。
- 第一次真实 Gemini 检查发现活动仍增加隅田公园，未计为通过；随后补充活动校验及指令，部署并再次核对，最终结果见下方交付记录。
- 本次没有调用照片 API；尚未由用户在 iPhone 复测这些新改动，不将浏览器和接口验证称为真机验证。

## 最终结果

最终云端版本 japan-travel-chat-00012-klb 已承接100%流量；构建 ab08eea5-4e5c-4eb5-a39c-7e50f9f20a9d 成功，健康检查200。运行身份及环境配置均未改变。最终真实Gemini请求一次返回完整Day 1，1人、JPY，景点及活动均围绕浅草寺，未再增加其他公园或观景塔。此项为真实接口验证，尚未在用户iPhone复测。

本次合计两次真实聊天请求，照片请求0次。手机端180项、服务端76项测试通过；临时视觉样例已删除。Expo Go原8086入口已重启，iOS manifest和完整bundle均200，原数据作用域不变。本次改动纳入 feat/places-guided-planning 分支和 PR #5 的 GitHub 交付。

用户随后按给定步骤测试，明确反馈“三项都正常”。此反馈指景点限制、免费/收费区分和官方入口测试，不扩展为后续全部UI已在手机验收。
