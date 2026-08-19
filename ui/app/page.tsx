"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  FileText,
  Plus,
  Sparkles,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";

type View = "create" | "analyzing" | "report";
type ReportTab = "overview" | "issues" | "layers" | "rules" | "copy";

const LAYERS = [
  ["视觉层面", 3.6, "主行动的视觉权重不足"],
  ["信息层面", 3.2, "页面目的需要更早说明"],
  ["交互层面", 3.4, "次要操作与主操作竞争"],
  ["流程导航", 3.8, "返回路径基本清楚"],
  ["反馈状态", 2.8, "关键状态需实机验证"],
  ["表单错误", 3.1, "错误恢复说明不足"],
  ["无障碍", 2.9, "焦点与键盘需实机验证"],
  ["信任风险", 4.0, "未发现明显诱导设计"],
  ["情绪体验", 3.7, "整体克制，反馈略显生硬"],
] as const;

const ISSUES = [
  { level: "P1", title: "页面到底想让用户先做什么不清楚", where: "问题在哪：会员卡、八个入口、下面的列表同时出现，视觉重量差不多。", layer: "主体任务", confidence: "高", impact: "用户看这个页面时，最容易被会员卡、八个入口和下面的列表同时抢注意力，不知道应该先点「了解更多」、看订单，还是去体重管理。", principle: "大白话判断", fix: "把页面主体定成「健康会员与体重管理」：会员卡做主入口，订单/购物车/优惠券降级成常用工具，体重管理列表放到第二层。" },
  { level: "P1", title: "会员卡像广告，但没有说清楚有什么用", where: "问题在哪：绿色会员卡面积最大，但只写了“量身定制方案、助力轻松减脂”，信息比较虚。", layer: "会员转化", confidence: "高", impact: "用户能看到会员卡很重要，但看不出开通后马上能得到什么，容易把它当成普通广告扫过去。", principle: "大白话判断", fix: "会员卡上直接写 2 个具体好处：如「生成减脂方案」「每周饮食建议」，按钮改成「查看会员方案」。" },
  { level: "P2", title: "八个图标入口没有主次", where: "问题在哪：订单、购物车、优惠券、健康花田、个人信息、活动中心、我的食物、智能设备都放在同一层。", layer: "入口分组", confidence: "高", impact: "用户要找健康相关功能时，需要逐个读图标；购物、活动、个人资料混在一起，扫描成本变高。", principle: "大白话判断", fix: "保留 4 个高频入口在第一排：体重、食谱、食物、设备；订单、优惠券、活动放到「更多服务」。" },
  { level: "P2", title: "下面列表哪些能点、哪些不可用不够明显", where: "问题在哪：「本周食谱」「上周小结」颜色很浅，但右侧仍有箭头，看起来像能点又像不能点。", layer: "状态反馈", confidence: "中", impact: "用户可能会点到不可用内容，也可能误以为内容加载失败。", principle: "大白话判断", fix: "不可用项要写原因，例如「本周食谱 · 会员解锁」或「暂无记录」，不要只用浅灰色。" },
  { level: "P2", title: "消息红点很抢眼，但和当前页面任务关系弱", where: "问题在哪：右上角消息 55 非常醒目，比健康管理任务更吸引注意。", layer: "干扰信息", confidence: "中", impact: "用户进入个人中心后可能先被消息数带走，影响完成体重管理、食谱查看等主要任务。", principle: "大白话判断", fix: "消息红点降到普通尺寸，只有重要健康提醒才在页面主体露出。" },
];

const STEPS = ["识别页面目标与主行动", "还原当前任务路径", "检查 Top 5 交互问题", "完成 9 大 UX 层面评分", "生成修改规则与文案建议"];
const WORKFLOW_HINTS = ["识别截图", "对照报告", "导出建议"];
const TOP_RECOMMENDATIONS = [
  ["先确认主行动", "只看最影响完成任务的按钮、反馈和文案。"],
  ["边看截图边改", "左侧固定原图，右侧每条问题都能回到界面对照。"],
  ["规则再落地", "修改建议图和护栏放在后面，避免一上来就被细节淹没。"],
] as const;

const ICONS: Record<string, LucideIcon> = {
  plus: Plus,
  clock: Clock3,
  upload: Upload,
  file: FileText,
  chevron: ChevronRight,
  check: Check,
  spark: Sparkles,
  close: X,
  arrow: ArrowRight,
  copy: Copy,
  download: Download,
  back: ArrowLeft,
};

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const Glyph = ICONS[name] ?? FileText;
  return <Glyph size={size} strokeWidth={1.8} aria-hidden="true" />;
}

export default function Home() {
  const [view, setView] = useState<View>("create");
  const [tab, setTab] = useState<ReportTab>("overview");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const risk = false;
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const canSubmit = Boolean(file);

  const acceptFile = useCallback((nextFile?: File) => {
    if (!nextFile) return;
    if (!/image\/(png|jpeg|webp)/.test(nextFile.type)) {
      setError("请上传 PNG、JPG 或 WebP 图片");
      return;
    }
    if (nextFile.size > 12 * 1024 * 1024) {
      setError("图片不能超过 12MB");
      return;
    }
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
    setError("");
  }, []);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => {
    if (view !== "create") return;
    function handlePaste(event: ClipboardEvent) {
      const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) => item.type.startsWith("image/"));
      const pastedImage = imageItem?.getAsFile();
      if (!pastedImage) return;
      event.preventDefault();
      acceptFile(pastedImage);
      showToast("已粘贴截图");
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [acceptFile, view]);

  useEffect(() => {
    if (view !== "analyzing") return;
    const timer = window.setInterval(() => {
      setProgress((value) => {
        const next = Math.min(value + 7 + Math.round(Math.random() * 10), 100);
        if (next === 100) {
          window.clearInterval(timer);
          window.setTimeout(() => setView("report"), 450);
        }
        return next;
      });
    }, 320);
    return () => window.clearInterval(timer);
  }, [view]);

  const analysisStep = STEPS[Math.min(Math.floor(progress / 21), STEPS.length - 1)];
  const pageTitle = file?.name.replace(/\.[^.]+$/, "") ?? "页面交互审查";
  const overallScore = useMemo(() => Math.round((LAYERS.reduce((sum, item) => sum + item[1], 0) / 45) * 100), []);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files[0]);
  }

  function removeFile() {
    setFile(null);
    setPreview("");
    if (fileInput.current) fileInput.current.value = "";
  }

  function startAudit() {
    if (!canSubmit) {
      setError("请先上传或粘贴一张界面截图");
      return;
    }
    setError("");
    setProgress(8);
    setView("analyzing");
  }

  function reset() {
    setView("create");
    setTab("overview");
    setProgress(0);
  }

  function reportMarkdown() {
    return `# ${pageTitle} · UX 示例审查报告\n\n> 当前内容为前端原型中的示例报告，尚未接入真实模型。\n\n## 整体结论\n\n评分：${overallScore} / 100\n\n核心任务可以完成，主行动与反馈链路仍需加强。\n\n## Top 5 问题\n\n${ISSUES.map((issue, index) => `${index + 1}. [${issue.level}] ${issue.title}：${issue.fix}`).join("\n")}\n\n## 说明\n\n动态状态、键盘、焦点、真实热区和辅助技术表现仍需实机验证。`;
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportMarkdown());
      showToast("示例报告已复制");
    } catch {
      showToast("复制失败，请稍后重试");
    }
  }

  function downloadReport() {
    const blob = new Blob([reportMarkdown()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${pageTitle}-UX示例审查.md`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("示例报告已导出");
  }

  if (view === "analyzing") {
    return <main className="analysis-page">
      <div className="analysis-shell">
        <div className="analysis-brand"><span className="brand-mark">UX</span><span>用户体验审查</span></div>
        <div className="analysis-grid">
          <div className="scan-panel">
            <img src={preview} alt="正在审查的界面" />
            <div className="scan-glow" />
            <span className="scan-label"><i /> 正在识别界面结构</span>
          </div>
          <div className="analysis-copy">
            <span className="kicker">UX INTERACTION AUDIT</span>
            <h1>正在生成对照报告</h1>
            <p>系统会先识别界面结构，再把最重要的问题放到报告首屏。当前为示例数据演示。</p>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            <div className="progress-row"><span>{analysisStep}</span><strong>{progress}%</strong></div>
            <div className="step-list">{STEPS.map((step, index) => {
              const done = progress >= (index + 1) * 20;
              const active = index === Math.min(Math.floor(progress / 21), 4);
              return <div className={done ? "done" : active ? "active" : ""} key={step}><span>{done ? <Icon name="check" size={13}/> : index + 1}</span>{step}</div>;
            })}</div>
            <button className="cancel-analysis" onClick={reset}><Icon name="back" size={15}/>返回修改</button>
          </div>
        </div>
      </div>
    </main>;
  }

  if (view === "report") {
    return <div className="report-page">
      <header className="report-header">
        <div><button className="back-link" onClick={reset}><Icon name="back" size={15}/>返回上传</button><h1>{pageTitle}<span className="sample-badge">示例报告</span></h1><p>截图评估 · 尚未接入真实模型</p></div>
        <div className="header-actions"><button onClick={copyReport}><Icon name="copy"/>复制报告</button><button className="dark" onClick={downloadReport}><Icon name="download"/>导出 Markdown</button></div>
      </header>

      <div className="report-split">
        <aside className="report-source-pane" aria-label="审查界面">
          <div className="source-pane-heading"><span>审查界面</span><strong>对照右侧报告逐项检查</strong></div>
          <div className="source-canvas has-image">
            <img src={preview} alt="正在审查的界面截图"/>
          </div>
          <div className="source-pane-foot"><span><i/>左侧可上下滚动</span><p>长截图可在左侧单独滚动看全，右侧报告继续对照检查。</p></div>
        </aside>

        <main className="report-results-pane">
          <div className="prototype-disclosure report-disclosure"><Icon name="spark" size={16}/><span><strong>示例数据 · 真实审查待接入</strong> 当前分数和建议只用于演示报告结构，不代表真实 UX 审查结论。</span></div>
          <section className="score-hero">
            <div className="score-ring" style={{ "--score": `${overallScore * 3.6}deg` } as React.CSSProperties}><div><strong>{overallScore}</strong><span>/ 100</span></div></div>
            <div className="score-summary"><span className="status-pill">可用，但需优化</span><h2>核心任务可以完成，主行动与反馈链路仍需加强。</h2><p>最大问题不是视觉精致度，而是用户能否快速确认“下一步做什么”以及“操作是否成功”。</p></div>
            <div className="score-meta"><span>最优层面<strong>信任与风险 · 4.0</strong></span><span>优先处理<strong>反馈状态 · 2.8</strong></span></div>
          </section>
          <section className="priority-strip" aria-labelledby="priority-title">
            <div>
              <span>FIRST LOOK</span>
              <h2 id="priority-title">先看这 3 个点</h2>
            </div>
            {TOP_RECOMMENDATIONS.map(([title, note], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><strong>{title}</strong><p>{note}</p></article>)}
          </section>

          <div className="report-layout">
            <nav className="report-nav" aria-label="报告章节">
              {([['overview','审查总览'],['issues','Top 5 问题'],['layers','9 层评分'],['rules','修改规则'],['copy','文案建议']] as [ReportTab,string][]).map(([key,label], index) => <button key={key} onClick={() => setTab(key)} className={tab === key ? "active" : ""} aria-current={tab === key ? "page" : undefined}><span>{String(index + 1).padStart(2,"0")}</span>{label}</button>)}
            </nav>

            <div className="report-content">
              {tab === "overview" && <Overview risk={risk}/>} 
              {tab === "issues" && <Issues />}
              {tab === "layers" && <Layers score={overallScore}/>} 
              {tab === "rules" && <Rules />}
              {tab === "copy" && <CopySuggestions />}
            </div>
          </div>
        </main>
      </div>
      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>;
  }

  return <div className="app-shell create-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">UX</span><span className="brand-copy"><strong>用户体验审查</strong><small>交互审查台</small></span></div>
      <button className="history-link" disabled title="历史记录即将开放"><Icon name="clock" size={18}/>历史记录</button>
    </header>
    <main className="create-main">
      <header className="create-header"><div><span className="tool-kicker">前端交互原型 · 当前展示为示例报告结构</span><h1>把设计图放进来</h1><p>不需要填写页面信息。上传、拖拽或直接粘贴截图，工具会生成左右对照的示例审查报告。</p></div></header>
      <section className="audit-workspace">
          <div className="workflow-hints" aria-label="审查流程">{WORKFLOW_HINTS.map((hint, index) => <span key={hint}><b>{index + 1}</b>{hint}</span>)}</div>
          {!file ? <div className={`dropzone ${dragging ? "dragging" : ""}`} onDragOver={(event) => {event.preventDefault();setDragging(true)}} onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => fileInput.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => {if (event.key === "Enter" || event.key === " ") fileInput.current?.click()}}>
              <span className="upload-mark"><Icon name="upload" size={29}/></span><strong>上传、拖拽或直接粘贴截图</strong><p>复制截图后按粘贴也可以 · PNG、JPG、WebP · 最大 12MB</p>
            </div> : <div className="file-preview"><img src={preview} alt="已选择的界面截图"/><div><span>截图已就绪</span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} MB · 可重新粘贴或点击右上角替换</small></div><button onClick={removeFile} aria-label="移除截图"><Icon name="close"/></button></div>}
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => acceptFile(event.target.files?.[0])}/>
          <div className="workspace-actions">
            <div className="privacy"><span />文件仅用于生成示例报告，不会存储或分享</div>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="submit-btn" disabled={!canSubmit} onClick={startAudit}>生成示例审查报告<Icon name="arrow"/></button>
            <p className="submit-note">{canSubmit ? "截图已就绪 · 约 3 秒生成报告" : "截图就绪后即可生成报告"}</p>
          </div>
      </section>
    </main>
  </div>;
}

function Overview({ risk }: {risk:boolean}) {
  return <>
    <div className="content-title"><span>01 / 审查总览</span><h2>页面基础判断</h2><p>先确认页面想帮助谁、完成什么，再判断设计是否合理。</p></div>
    <dl className="judgement-card overview-judgement"><div><dt>页面类型</dt><dd>任务型操作页面</dd></div><div><dt>推测目标用户</dt><dd>希望快速完成当前任务的存量用户</dd></div><div><dt>用户核心任务</dt><dd>理解选择、确认后果并完成主操作</dd></div><div><dt>当前主行动</dt><dd>确认并继续</dd></div><div><dt>识别方式</dt><dd>系统自动判断</dd></div><div><dt>风险权重</dt><dd>{risk ? "高 · 已加强信任与风险检查" : "常规"}</dd></div></dl>
    <div className="path-card"><div className="card-heading"><div><span>当前任务路径</span><h3>从理解到完成，共 6 个关键节点</h3></div><small>第 3–5 步风险较集中</small></div><div className="path-flow">{["看到页面","理解目的","寻找主操作","确认选择","等待反馈","完成任务"].map((item,index)=><div key={item} className={index >= 2 && index <= 4 ? "warn" : ""}><span>{index+1}</span><strong>{item}</strong>{index < 5 && <Icon name="chevron" size={14}/>}</div>)}</div></div>
    <button className="next-section" onClick={() => document.querySelector<HTMLButtonElement>('.report-nav button:nth-child(2)')?.click()}>查看最重要的 5 个问题 <Icon name="arrow"/></button>
  </>;
}

function Issues() {
  return <><div className="content-title"><span>02 / TOP 5</span><h2>最重要的 5 个问题</h2><p>不用抽象术语，直接说明截图里哪里让人看不懂、为什么会影响操作。</p></div><div className="issue-list">{ISSUES.map((issue,index)=><article key={issue.title}><div className="issue-index">{String(index+1).padStart(2,"0")}</div><div className="issue-body"><div className="issue-title"><span className={`priority ${issue.level.toLowerCase()}`}>{issue.level}</span><h3>{issue.title}</h3><span className="confidence">{issue.confidence}置信</span></div><div className="issue-tags"><span>{issue.layer}</span><span>{issue.principle}</span></div><p className="issue-location"><strong>问题在哪</strong>{issue.where.replace("问题在哪：", "")}</p><p>{issue.impact}</p><div className="fix"><strong>怎么改</strong><span>{issue.fix}</span></div></div></article>)}</div></>;
}

function Layers({score}:{score:number}) {
  return <><div className="content-title"><span>03 / 9 LAYERS</span><h2>9 大 UX 层面评分</h2><p>截图无法验证的动态状态、焦点与键盘行为已降低置信度。</p></div><div className="layer-summary"><div><strong>{score}</strong><span>/ 100</span></div><p><b>可用，但需优化</b>优先补齐反馈状态与无障碍实机走查。</p></div><div className="layer-list">{LAYERS.map(([name,score,note],index)=><div key={name}><span className="layer-num">{String(index+1).padStart(2,"0")}</span><strong>{name}</strong><div className="layer-bar"><span style={{width:`${score/5*100}%`}}/></div><b>{score.toFixed(1)}</b><p>{note}</p></div>)}</div></>;
}

function Rules() {
  const rules = [
    { change: "把会员卡改成页面主卡片，只保留一个明显按钮。", reason: "因为现在会员卡最大，但价值说得虚；用户需要马上知道开通后能得到什么。" },
    { change: "把健康相关入口放第一组：体重、食谱、食物、设备。", reason: "因为这是健康生活个人中心，先让用户完成健康任务，购物和活动不要抢第一屏注意力。" },
    { change: "订单、优惠券、活动中心放进「更多服务」或第二组。", reason: "因为这些是辅助入口，和体重管理、饮食建议不是同一类任务，混在一起会让页面没有主体。" },
    { change: "灰色不可用列表项必须写原因，例如「暂无记录」或「会员解锁」。", reason: "因为只变浅不说明原因，用户会分不清是不能点、没数据，还是页面坏了。" },
    { change: "右上角消息红点降权，只保留正常提醒样式。", reason: "因为 55 的红点太抢眼，会把用户从当前健康管理任务里拉走。" },
    { change: "继续沿用原来的绿色、圆角卡片和柔和图标，不换成另一套风格。", reason: "因为问题主要是层级和分组，不是品牌视觉本身；乱换风格会增加新的理解成本。" },
  ];
  return <><div className="content-title"><span>04 / REVISION RULES</span><h2>修改规则与页面建议</h2><p>每条规则都说明改动点和为什么这么改，避免只给一句抽象原则。</p></div><section className="revision-preview-card" aria-labelledby="revision-preview-title"><div className="revision-preview-copy"><span>修改后页面建议图</span><h3 id="revision-preview-title">保留绿色体系，把页面主体改清楚</h3><p>核心不是“做得更酷”，而是让用户一眼知道：这里主要是看会员权益、体重管理和饮食建议。</p><ul><li>主卡片说明会员具体价值</li><li>健康任务入口优先展示</li><li>弱化购物、活动、消息干扰</li></ul><a href="/suggested-personal-center-complete.png" target="_blank" rel="noreferrer">查看完整建议图 <Icon name="arrow" size={14}/></a></div><div className="revision-preview-canvas" role="region" aria-label="修改后建议图，可上下滚动查看完整页面"><span>修改后建议图 · 在图内上下滚动查看完整页面</span><img src="/suggested-personal-center-complete.png" alt="完整展示底部导航、去除黑色底和异常浮层的个人中心修改建议图"/></div></section><div className="rules-subheading"><span>具体改动</span><strong>为什么这么改</strong></div><div className="rules-list change-list">{rules.map((rule,index)=><div key={rule.change}><span>{index+1}</span><p><strong>改动点：</strong>{rule.change}<br/><em>为什么：</em>{rule.reason}</p><button aria-label={`复制规则 ${index + 1}`} onClick={() => navigator.clipboard?.writeText(`${rule.change} ${rule.reason}`)}><Icon name="copy" size={15}/></button></div>)}</div><div className="rule-guard"><Icon name="spark"/><div><strong>质量门禁</strong><p>如果一条改动说不清“改哪里”和“为什么”，就先不要放进建议里。</p></div></div></>;
}

function CopySuggestions() {
  const rows = [
    ["了解更多", "查看会员方案", "明确点击后会看到会员权益和方案，不再像一句泛化广告。"],
    ["量身定制方案，助力轻松减脂", "生成减脂方案 · 每周饮食建议", "把抽象承诺改成用户开通后能得到的具体服务。"],
    ["本周食谱", "本周食谱 · 会员解锁", "直接说明当前不可用的原因，避免用户误以为页面失效。"],
    ["上周小结", "上周小结 · 暂无记录", "说明灰色状态代表没有数据，而不是按钮损坏。"],
    ["减重咨询", "咨询减重顾问", "明确点击后会进入什么服务，减少用户猜测。"],
  ];
  return <><div className="content-title"><span>05 / MICROCOPY</span><h2>当前审查页面的文案修改建议</h2><p>只列出左侧截图中真实出现的文案，并说明改成什么、为什么。</p></div><div className="copy-table"><div className="copy-head"><span>审查图中的原文案</span><span>推荐文案</span><span>为什么这样改</span></div>{rows.map(row=><div key={row[0]}><span>{row[0]}</span><strong>{row[1]}</strong><p>{row[2]}</p></div>)}</div><div className="final-summary"><span>本页文案重点</span><p>这张个人中心页面最需要调整的是：<strong>把会员价值说具体，并给灰色不可用项补充原因</strong>，让用户不用猜按钮会去哪里、功能为什么暂时不能用。</p></div></>;
}
