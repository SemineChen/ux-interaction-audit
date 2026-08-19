import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the upload-only UX audit workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>UX 交互审查台<\/title>/i);
  assert.match(html, /用户体验审查/);
  assert.match(html, /把设计图放进来/);
  assert.match(html, /上传、拖拽或直接粘贴截图/);
  assert.match(html, /粘贴截图/);
  assert.match(html, /截图就绪后即可生成报告/);
  assert.match(html, /识别截图/);
  assert.match(html, /对照报告/);
  assert.match(html, /导出建议/);
  assert.match(html, /前端交互原型/);
  assert.match(html, /当前展示为示例报告结构/);
  assert.match(html, /生成示例审查报告/);
});

test("does not render the removed description intake flow", async () => {
  const response = await render();
  const html = await response.text();

  assert.doesNotMatch(html, /描述页面或流程/);
  assert.doesNotMatch(html, /页面或流程描述/);
  assert.doesNotMatch(html, /至少 20 字/);
  assert.doesNotMatch(html, /<textarea\b/i);
  assert.doesNotMatch(html, /role="tablist"/i);
});

test("centers the upload workspace without changing the title layout", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /\.create-header\{[^}]*margin:0 0 22px/);
  assert.doesNotMatch(css, /\.create-header\{[^}]*text-align:center/);
  assert.match(css, /\.audit-workspace\{[^}]*margin:0 auto/);
  assert.match(css, /\.workspace-actions\{[^}]*align-items:center/);
  assert.match(css, /\.privacy\{[^}]*justify-content:center[^}]*text-align:center/);
});

test("report makes the source image scrollable and explains findings plainly", async () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(css, /\.source-canvas\{[^}]*overflow:auto/);
  assert.match(css, /\.source-canvas\.has-image img\{[^}]*height:auto/);
  assert.match(page, /问题在哪/);
  assert.match(page, /用户看这个页面时，最容易被会员卡、八个入口和下面的列表同时抢注意力/);
  assert.match(page, /具体改动/);
  assert.match(page, /为什么这么改/);
  assert.match(page, /suggested-personal-center-complete/);
  assert.doesNotMatch(page, /修改后 · 高清同风格升级/);
});

test("revision preview scrolls internally so the full image stays available", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(css, /\.revision-preview-canvas\{[^}]*height:clamp\(320px,48vh,520px\)[^}]*overflow-y:auto/);
  assert.match(css, /\.revision-preview-canvas img\{[^}]*height:auto[^}]*max-height:none/);
  assert.match(page, /role="region"/);
  assert.match(page, /aria-label="修改后建议图，可上下滚动查看完整页面"/);
  assert.match(page, /可上下滚动查看完整页面/);
  assert.match(page, /suggested-personal-center-complete\.png/);
  assert.doesNotMatch(page, /src="\/suggested-personal-center-clean\.png"/);
});

test("copy suggestions are grounded in the audited personal-center screen", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /当前审查页面的文案修改建议/);
  assert.match(page, /查看会员方案/);
  assert.match(page, /本周食谱 · 会员解锁/);
  assert.match(page, /上周小结 · 暂无记录/);
  assert.match(page, /咨询减重顾问/);
  assert.doesNotMatch(page, /\["提交","确认并继续"/);
  assert.doesNotMatch(page, /请输入手机号，用于接收验证结果/);
});
