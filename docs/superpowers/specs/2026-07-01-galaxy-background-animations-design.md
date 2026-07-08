# 诗文长河 — 银河背景动画增强

## Context

`RiverBackground` 当前已有两层动画：60 颗星各自闪烁（`twinkle`）+ 4 团星云缓慢漂移（`nebula-drift`）。银河主带、月亮都是静态的，整体氛围感不足。

用户要求把背景的星河做出更丰富的动态效果，并明确选定四种叠加：

1. **流星偶尔划过** — 偶发存在感强
2. **银河主带横向流动** — 呼应"流动"主题
3. **鼠标视差** — 纵深交互感
4. **星点整体漂移** — 整片星空极慢平移

所有效果均作用于 `RiverBackground`，节点层（诗人/诗篇节点）不受影响。需同时同步到 `scripts/build-standalone.cjs` 的 `riverBackgroundCode` 模板。

## Approach

四个效果互相独立，叠加渲染顺序：星云 → 银河主带 → 星点（容器层） → 月亮 → 流星。每层动画参数都偏"氛围级"（缓慢、低调），避免抢戏。

### 1. 流星偶尔划过

预生成 10 个流星对象，每个有独立的：

- 起点：画布上方随机 x（10-90%）
- 角度：25-35° 斜向下右
- 距离：300-500px
- `duration`：1.0-1.6s
- `delay`：负值错开（-4s 到 -14s），保证页面打开后立即有流星，但永不全部同步
- `iterationCount`：infinite
- 尾迹长度：80-120px，用 `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.9) 100%)`
- 整体 `transform: rotate(θ)` 让流星沿其角度方向

新增 keyframe：

```css
@keyframes shooting-star {
  0%   { opacity: 0; transform: translate(0, 0) rotate(var(--angle)); }
  10%  { opacity: 1; }
  100% { opacity: 0; transform: translate(var(--dx), var(--dy)) rotate(var(--angle)); }
}
```

实际实现：每个流星一个 `<div>`，inline style 设 width/height（细长条）、background-gradient、`--angle`/`--dx`/`--dy` CSS variables、animation。

**视觉：** 平均每 5-8 秒有一颗流星划过；尾迹清晰但不刺眼。

### 2. 银河主带横向流动

修改现有 Milky Way band `<div>`：

- `background-size: 200% 100%` （让 gradient 可被 shift 一倍宽度）
- `animation: river-flow 120s linear infinite` — 复用已有 keyframe（`background-position: 0% 0% → 200% 0%`）
- 其他属性（filter blur、transform、height）保留

**视觉：** 银河带本身缓慢从左向右"流"，三处亮斑跟随移动，120s 周期足够慢、不抢戏。

### 3. 鼠标视差

`RiverBackground` 改为接受 mouse 位置状态：

- 新增 `useEffect` 在 `window` 上挂 `mousemove` listener
- 计算 `mx = (e.clientX / window.innerWidth - 0.5) * 2 ∈ [-1, 1]`，`my` 同理
- 用 `requestAnimationFrame` 节流，存到 `useState`
- 通过 `useRiverViewport().dragging`（现有 state，line 102）判断拖动状态，拖动期间冻结视差
- 各层根据深度系数应用 `translate`：

| 层 | 深度系数 | 最大位移 |
|----|---------|---------|
| 月亮 | 1.0 | ±12px |
| 银河主带 | 0.7 | ±8.4px |
| 星云容器 | 0.5 | ±6px |
| 星点容器 | 0.3 | ±3.6px |

- 实现方式：每层 inline style 的 `transform` 拼 `translate(...)`，与已有 transform 链式组合
- 已有 transform 的层（如银河带 `translateY(-50%)`）需要合并：`translateY(-50%) translate(${px}px, ${py}px)`

**关键决策：** 视差作用在 `RiverBackground` 内部各层，不影响外层画布的 `transform: scale`（缩放/平移由 `useRiverViewport` 控制，互不干扰）。

**视觉：** 鼠标移动时，月亮位移最大、星点几乎不动，制造"月远星近"的纵深错觉；拖动画布时不响应，避免与平移打架。

### 4. 星点整体漂移

在 60 颗 `<div>` 星点外层包一个 `<div class="stars-layer">`：

- 容器 `position: absolute; inset: 0;`
- `animation: stars-drift 360s ease-in-out infinite alternate`
- 内部星点保持现有 `twinkle` 动画（在 child div 上，不冲突）

新增 keyframe：

```css
@keyframes stars-drift {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50px); }
}
```

**视觉：** 整片星空极慢（6 分钟一周期）来回横移；和视差叠加时，视差给瞬时响应、漂移给持续运动，两者互补。

## Files to modify

| 文件 | 改动 |
|------|------|
| `src/components/RiverBackground.tsx` | 改为接受 `dragging: boolean` prop，加 4 套动画 |
| `src/styles.css` | 新增 `@keyframes shooting-star`、`@keyframes stars-drift` |
| `src/pages/RiverPage.tsx` | 传 `vp.dragging` 给 `RiverBackground` |
| `src/pages/PoetPage.tsx` | 同上 |
| `scripts/build-standalone.cjs` | 同步 `riverBackgroundCode` 模板的 4 套动画 + keyframes |
| `standalone.html` | `npm run build:standalone` 重新生成 |

## Existing code to reuse

- `@keyframes river-flow`（`src/styles.css`）— 银河带流动
- `@keyframes twinkle`（`src/styles.css`）— 单颗星闪烁
- `@keyframes nebula-drift`（`src/styles.css`）— 星云漂移
- `useRiverViewport().dragMovedRef`（现有）— 判断是否处于拖动状态
- 4 团 `NEBULA_CLOUDS`、60 颗 `STARS`、银河带 gradient、月亮 — 全部保留

## Verification

1. `npm test` — 28/28 现有测试保持通过
2. `npm run dev` 浏览器手动验证：
   - 流星：打开页面后 5-10s 内能看到至少一颗流星划过；不同流星方向、时间不重复
   - 银河带：缓慢从左向右流动，120s 周期；不抢戏但肉眼可见
   - 鼠标视差：移动鼠标时月亮明显位移、星点几乎不动；按住拖动画布时视差不响应
   - 星点漂移：6 分钟周期内整片星空缓慢左移再右回；与单星 twinkle 互不干扰
   - 节点交互（点击/拖动/缩放）不受影响
3. `npm run build:standalone && npm run verify:standalone` — `standalone.html` 重新生成、Babel 编译通过
4. 双击 `standalone.html` — file:// 协议下 4 套动画正常显示

## Known limitations / risks

- **性能**：60 颗星 + 4 团星云 + 10 流星 = 74 个动画元素，全部用 transform/opacity（GPU 加速），理论 60fps，但低端机可能掉帧。如出现卡顿可降低流星数 / 星点数
- **视差+缩放冲突**：视差作用在 `RiverBackground` 内部层，缩放作用在外层 canvas，理论上独立；若发现叠加时跳动，需要给内层加 `will-change: transform`
- **流星角度固定**：所有流星都向右下角方向（25-35°），如果未来想做"偶有反向"，需要扩展 CSS 变量
- **standalone 模式**：mousemove listener 在 standalone 下同样工作（Babel 编译 React），无需特殊处理
