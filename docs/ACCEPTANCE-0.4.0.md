# 0.4.0 预览精确选区评论验收 · 2026-09-12

## 交付范围

仅修改 exmd。正文 codec/schema/protocol 和 v2 评论编码不变；没有新建评论网络、WebSocket、自动保存或持久化。Doca 继续负责身份、正文与评论权限、卡片、评论正文、存储、ACK 和通知。原 0.3.0 安装包保留。

## 本版实现

- 解析器源偏移 + HAST 叶节点 + UTF-16 字符区间映射；不按整段/整行捕获，不用全文搜索选中文字。
- `captureAnchor()` 按活动视图读取。纯预览无有效选区返回 null，不使用源码遗留选区。
- `renderAnchors/setActiveAnchor/onAnchorClick/revealAnchor/clearAnchors` 共用两侧语义，纯预览定位保持纯预览。
- 未激活黄色下划线、激活黄色背景；重叠位置每次点击轮流激活其中一条。解决、删除、移除、orphan 均停止绘制。
- 预览装饰使用原生 DOM Range 几何投影，不分割/重写可选文字节点。滚动、尺寸、缩放和字体加载重新测量。
- 宿主 `selectionActions/toolbarActions` 支持 icon/title/disabled/onClick；`selectionToolbar=false` 固定顶部。按钮保持原生选区，评论权限不等于正文编辑权限。
- 保留原始 CRLF 的 CR 字符，避免 CodeMirror 默认拆行规范化引发模型偏移/初始化正文修改；不对已存在的 Y.Text 进行规范化迁移。

## 构建阶段实测

| 范围 | 结果 |
| --- | --- |
| 类型检查、库与 demo 生产构建 | 通过；demo 仍有大 chunk 提示 |
| 原有模型 contract | 11/11 通过 |
| 原有浏览器回归 | 7 个分组通过；预览 reveal 预期更新为保持预览 |
| 新预览浏览器回归 | 7 个分组通过，具体如下 |
| 真实鼠标源码拖选 Bravo | 宿主动作返回 source，范围 8..13，源文 Bravo |
| 真实鼠标预览拖选 Bravo | 宿主动作返回 preview，同样范围 8..13，点击后保留选区 |
| 实际 60 秒静置 | 60146ms；交替两侧选区、滚动、尺寸和保存状态变化、评论激活/取消，0 正文更新且实例稳定 |

预览回归的 7 个分组：

1. 粗体五字符，同行/不同段重复文本，空预览选区不回取源码。
2. 嵌套 strong/em、链接部分标签、软换行/硬换行、引用前缀、实体、转义、行内代码、列表缩进和表格单元格。
3. 两侧下划线/激活背景、预览卡片定位、重叠评论轮流点击、取消激活。
4. 正文只读仍可评论、宿主禁用权限、mousedown 保持选区、回调参数、顶部插槽降级。
5. 本地与远端插删、原生预览选区随相对位置恢复、源码/预览切换、1.25 CSS 缩放与滚动后矩形误差小于 2px。
6. resolved/deleted/移除/orphan 清理；CodeMirror/handle 身份不变；没有包内网络/存储。
7. 中文/emoji、数字实体、CRLF 原文不改写、引用链接、内联颜色/伪造映射属性防护、DOM 元素边界、公式和高亮代码拒绝近似捕获。

浏览器代码：`tests/browser/preview.js`、`runner.js`、`client.jsx`。真实 DOM Range/CodeMirror/Y.Doc 在隔离 iframe 页面中运行，宿主夹具转发原始 updates；不是 Doca 生产双标签页/真实网络验收。鼠标拖选通过浏览器界面执行。只有本地正文修改可以进入 update 订阅，评论及选区 UI 不进入保存链路。

## 复跑

```sh
yarn build
yarn test:contract
yarn test:idle
yarn test:browser
```

浏览器 `/tests/browser/index.html` 的“运行回归”“运行预览精确评论验收”“运行 60 秒静置”是独立入口。另有“查看光标与区域评论”供原生鼠标操作。`/?host=1` 是带独立评论权限和宿主卡片的运行示例，npm 包内 `examples/DocaComments.tsx` 可复制到宿主。

实际 tarball 的安装、哈希和再验收结果记录在仓库根 `DELIVERY-0.4.0.md`，避免哈希与包内报告互相依赖。

## 接口语义与限制

- 跨格式/跨段选择保存连续源码范围；内部 Markdown 标记和链接语法自然位于范围内。单一可见实体映射到完整原始编码，不伪装成一个源字符。
- 公式、Mermaid/SVG、图片本体、代码块高亮、任意 HTML 块或其他不能建立严格映射的生成内容不支持预览捕获；返回 null，可转源码评论。不支持旋转/倾斜坐标适配。
- 重叠采用轮流点击，没有重叠评论列表弹窗。评论卡片及持久化属于宿主。海量锚点性能、其他浏览器/移动端专项未验收。
- 完全删除后的 orphan 策略沿用 0.3.0：撤销恢复文字不自动重绑旧评论。
- 自定义 Preview 需透传 interaction；自定义 Toolbar 需渲染 hostActions。不透传不会自动拥有这些能力。
- Portal 位于 document.body。Doca 全量 PostCSS 限定祖先时，需要另外保留悬浮工具栏的样式；评论矩形本身用内联几何/颜色，不依赖平台类名。
- 未修改或重验 Doca 的生产安装、WebSocket、数据库 ACK、资源鉴权与持久化。平台升级后仍应复验真实评论流程。
