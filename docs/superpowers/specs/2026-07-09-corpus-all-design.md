# 总库（'all'）切换选项 — Design

**Date:** 2026-07-09
**Status:** Approved (user 执行指令)
**Predecessor:** `2026-07-08-primary-corpus-design.md`

## 目的

在「唐诗三百首」/「小学必背」之上新增第三个切换选项「总库」：跨两库的全部 341 首去重视图。当前用户只能在两个子库之间切换，没有「总览全部」入口。

## 不做的事

- 不改 `PoemCorpus` / `PoetCorpus` 数据层类型 — 数据层 `'both'` 已表达「两库共有」，新加 `'all'` 会冗余。
- 不改 `KEYWORDS` / `PRIMARY_KEYWORDS` 列表本身。
- 不修复 PoemsRiverPage 时间轴硬编码 618–907（pre-existing 问题：primary / all 模式下非唐诗人会被裁剪到视图外，独立 issue）。
- 不引入新的关键字清单 — 总库直接用 `KEYWORDS`（50 字，源自全集扫描）。

## 架构

### 类型层

```ts
// src/state/corpus.tsx
export type Corpus = 'tang' | 'primary' | 'all';
```

`PoemCorpus` 保持 `'tang' | 'primary' | 'both'` 不变。

**边界映射约定**：state 层 `'all'` → 数据层 `'both'`。在每个 `getPoems(corpus)` / `getPoets(corpus)` 调用点写 `corpus === 'all' ? 'both' : corpus`。不引入抽象 helper（5 个调用点，直接写更直观）。

### State 层

```ts
// STORAGE_KEY = 'feihuaCorpus'，接受 'tang' | 'primary' | 'all'
// 默认仍是 'tang'（不改变现有用户体验）
// 跨标签页 storage 事件接受 'all' 作为合法值
```

### Switcher

3 段：唐诗三百首 / 小学必背 / 总库。Mobile 下分别显示「唐诗」/「小学」/「总库」。3 段控制略宽，但仍能放进 TopNav 右侧槽位（实测 ≈240px mobile / ≈360px desktop）。

### Pages

| Page | corpus='all' 行为 |
|------|-------------------|
| PoemsRiverPage | 标题「总 库」；`getPoems('both')` 返回全部 341 首 |
| PoetPage | 不渲染「看全部」toggle（已是全集）；filter 跳过；空态用「该诗人无作品」（不再分库） |
| PoemPage | `inScope = true`（任何诗都属总库）；隐藏「不在当前诗库」提示 |
| PlayHall | 「当前诗库：总库」；`charKeywords = KEYWORDS`（50 字三档）；30→50 关 sentence levels |

**PoetPage 空态语义**：corpus='all' 下，如果某诗人 0 作品，文案为「该诗人无作品」（去掉「在 X 库中」前缀）。

### Engine / Couplets / Progress

- `buildKeywordIndex(corpus: PoemCorpus)` 已支持 `'both'` — state='all' 在调用点映射。
- `pickStageQuestion(keyword, used, corpus)` / `pickLevelQuestion(tier, used, corpus)` 同上。
- `loadProgress(corpus: Corpus)` / `loadSentenceProgress(corpus: Corpus)`：`storageKey('all') = 'shiwen-feihua-progress:all'` / `'shiwen-feihua-sentence-progress:all'`（沿用现有 `${STORAGE_KEY}:${corpus}` 模式，无需新逻辑）。

**进度独立**：总库进度与 tang/primary 互不影响。用户在总库通关的字不会同步到子库进度。

### 跨切库导航

`CorpusSwitcher.onSwitch` 已有逻辑：在 `/play/stage/*` 或 `/play/sentence/*` 路径下切库时 `navigate('/play')`。这对切到/切出 'all' 同样适用，无需改。

## 测试

新增 `tests/corpus-all.test.tsx`：
1. `CorpusProvider` 接受 localStorage `feihuaCorpus='all'` 并通过 `useCorpus()` 返回。
2. `useSetCorpus('all')` 写入 localStorage。
3. PoemsRiverPage 在 corpus='all' 下渲染标题「总 库」。
4. PoemPage 在 corpus='all' 下任何诗都 inScope（不渲染切库提示）。
5. PoetPage 在 corpus='all' 下不渲染「看全部」toggle。
6. PlayHall 在 corpus='all' 下显示「总库」标签 + 50 关。

新增 `tests/progress-all.test.ts`：
7. `loadProgress('all')` 与 `loadProgress('tang')` 读写不同 key，互不污染。

## 改动文件清单

| 类型 | 文件 |
|------|------|
| Modify | `src/state/corpus.tsx` |
| Modify | `src/components/CorpusSwitcher.tsx` |
| Modify | `src/pages/PoemsRiverPage.tsx` |
| Modify | `src/pages/PoetPage.tsx` |
| Modify | `src/pages/PoemPage.tsx` |
| Modify | `src/pages/PlayHall.tsx` |
| Modify | `src/pages/StagePlay.tsx`（仅 corpusToPoemCorpus 边界映射，如果有的话） |
| Modify | `src/pages/SentencePlay.tsx`（同上） |
| Modify | `src/play/engine.ts`（callers 映射） |
| Modify | `src/play/couplets.ts`（callers 映射） |
| Modify | `src/play/progress.ts`（storageKey 已自然支持，无需改逻辑） |
| Modify | `src/play/sentenceProgress.ts`（同上） |
| Modify | `scripts/build-standalone.cjs`（镜像全部上述） |
| Create | `tests/corpus-all.test.tsx` |
| Create | `tests/progress-all.test.ts` |

## 已知限制（沿用 / 新增）

- **沿用**：PoemsRiverPage 时间轴 618–907 硬编码，非唐诗人定位会超出可视区。primary 模式已有此问题，all 模式继承。**独立 issue，不在本计划内修复。**
- **沿用**：I3（scraper dynastyId 硬编码）+ I4（19 spec-listed primary 诗人缺失）— 见上一计划 ledger。
- **新增**：总库进度独立，用户在总库通关不会自动同步到子库。这是设计决策（避免双写复杂度），不是 bug。

## 不做的事（明确排除）

- 不为总库引入合并关键字清单（如 KEYWORDS ∪ PRIMARY_KEYWORDS 去重）。总库直接用 50 字 KEYWORDS，每字已保证 ≥5 句跨全集。
- 不在 PoemsRiverPage 修复时间轴跨朝代问题。
- 不动数据层 `PoemCorpus` / `PoetCorpus`。
- 不为总库引入新的飞花令玩法或新关卡数。
