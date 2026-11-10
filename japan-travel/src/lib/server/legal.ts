const external = '<p>Google Maps 服务条款：<a href="https://cloud.google.com/maps-platform/terms">Google Maps Platform Terms</a>；Google 隐私政策：<a href="https://policies.google.com/privacy">Google Privacy Policy</a>。</p>';
export function legalDocument(document: string): Response {
  const privacy = document === 'privacy';
  if (!privacy && document !== 'terms') return new Response('Not found', { status: 404 });
  const title = privacy ? '隐私说明' : '测试版使用条款';
  const body = privacy ? `<p>日本旅行助手为团队比赛测试应用。您输入的当前对话会发送至团队的 Google Cloud 服务，并交由 Vertex AI Gemini 处理，用于生成旅行建议。新版App会将对话文字、草稿及未完成消息保存在当前设备，供重新打开后查看和继续；您可以在聊天历史中删除本机记录。聊天历史不包含API密钥、会话凭据或Google照片，也不会自动同步到另一台设备。</p>
<p>测试不要求业务账号或 Gemini 密钥。服务器保存匿名会话的哈希、有效期、用量计数、请求状态和 token 用量。会话通常四小时失效；失效不代表数据库记录立即删除。基础设施可能保留请求时间、状态和网络等技术日志，保留期限依团队的云项目配置及 Google 政策执行。应用日志不应记录对话正文、API 密钥或会话令牌。</p>
<p>启用 Google Places 照片时，景点名称和城市会发送到 Google Maps Platform。加载照片及打开地图、作者链接也会与 Google 服务通信。Google 图片和署名只为当前界面展示，不由本应用写入本地持久存储或用作模型训练。</p>
<p>请不要在测试对话中输入身份证件、支付资料等敏感信息。关于测试数据或撤销会话，请通过向您提供本应用的团队联系渠道反馈，也可通过 <a href="https://github.com/Rean0623">开发者 GitHub</a> 联系团队。</p>` :
`<p>本应用用于日本旅行规划的内部测试与比赛展示。使用 Google Maps 内容时，同时须遵守下方 Google Maps Platform 条款；不得擅自抓取、保存或移除照片署名。</p>
<p>AI 行程、预算、交通与营业信息是规划建议，可能不准确或过时。请在出行及预订前核对官方来源。应用不代为保存正式行程、预订、支付，也不保证推荐可预约或价格有效。</p>
<p>请勿滥用匿名测试入口、绕过限额、盗用凭据或提交违法内容。团队可关闭测试入口。照片版权属于相应权利人，作者和来源在照片旁标示。</p>`;
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · 日本旅行助手</title><style>body{max-width:680px;margin:40px auto;padding:0 20px;font:16px/1.8 system-ui;color:#202020;background:white}a{color:inherit}h1{font-size:26px}</style></head><body><h1>${title}</h1><p>更新：2026-11-08</p>${body}${external}<p><a href="/legal/terms">使用条款</a> · <a href="/legal/privacy">隐私说明</a></p></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'", 'X-Content-Type-Options': 'nosniff' } });
}
