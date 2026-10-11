/**
 * 图层面板：把场景元素组织成"元素 / 分组 / 画框"的树，并提供显隐、锁定、
 * 改名、删除、层级排序等操作。
 *
 * 说明：
 * - 面板从上到下 = 画布从最上层到最下层。
 * - 形状内的绑定文字不单独成行，跟随其形状。
 * - 隐藏/锁定作用到整行（分组、画框包含全部后代）。
 */
import { CaptureUpdateAction } from "@excalidraw/excalidraw";

import {
  getBoundTextElementId,
  newElementWith,
  syncInvalidIndices,
} from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/** 面板操作只需要这两个方法，接受 imperative API 或 App 实例 */
export type LayerApp = Pick<
  ExcalidrawImperativeAPI,
  "updateScene" | "getSceneElementsIncludingDeleted"
>;

export type LayerNodeKind = "element" | "group" | "frame";

export type LayerNode = {
  id: string;
  kind: LayerNodeKind;
  name: string;
  hidden: boolean;
  locked: boolean;
  /** 本行控制的全部元素 id（分组/画框为全部后代） */
  elementIds: string[];
  /** 排序用：后代元素在场景数组中的最大下标（越大越靠上） */
  zKey: number;
  children: LayerNode[];
  parentId: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  rectangle: "矩形",
  diamond: "菱形",
  ellipse: "椭圆",
  arrow: "箭头",
  line: "线条",
  freedraw: "自由绘制",
  text: "文本",
  image: "图片",
  frame: "画框",
  magicframe: "魔框",
  embeddable: "嵌入",
  iframe: "网页",
};

export const isFrameElement = (element: ExcalidrawElement) =>
  element.type === "frame" || element.type === "magicframe";

/** 面板中单独成行的元素（排除绑定文字） */
export const isListedElement = (element: ExcalidrawElement) =>
  !element.isDeleted && !(element.type === "text" && !!element.containerId);

export const getElementDisplayName = (element: ExcalidrawElement): string => {
  if (element.type === "frame" || element.type === "magicframe") {
    return element.name || "画框";
  }
  if (element.layerName) {
    return element.layerName;
  }
  if (element.type === "text") {
    const text = element.text.trim().replace(/\s+/g, " ");
    return text ? text.slice(0, 24) : "文本";
  }
  return TYPE_LABELS[element.type] ?? element.type;
};

/** 构建图层树；元素按场景数组顺序（自下而上）传入 */
export const buildLayerTree = (
  elements: readonly ExcalidrawElement[],
  groupNames: Record<string, string> = {},
): LayerNode[] => {
  const zOf = new Map<string, number>();
  elements.forEach((element, index) => zOf.set(element.id, index));

  const listed = elements.filter(isListedElement);
  const frameIds = new Set(
    listed.filter(isFrameElement).map((element) => element.id),
  );

  const nodes = new Map<string, LayerNode>();
  const childIds = new Map<string, string[]>();
  const pushChild = (parentId: string | null, childId: string) => {
    const key = parentId ?? "";
    const arr = childIds.get(key) ?? [];
    arr.push(childId);
    childIds.set(key, arr);
  };

  const ensureGroupNode = (groupId: string) => {
    if (!nodes.has(groupId)) {
      nodes.set(groupId, {
        id: groupId,
        kind: "group",
        name: "分组",
        hidden: false,
        locked: false,
        elementIds: [],
        zKey: -1,
        children: [],
        parentId: null,
      });
    }
  };

  // 画框节点（顶层）
  for (const element of listed) {
    if (!isFrameElement(element)) {
      continue;
    }
    nodes.set(element.id, {
      id: element.id,
      kind: "frame",
      name: getElementDisplayName(element),
      hidden: !!element.hidden,
      locked: !!element.locked,
      elementIds: [element.id],
      zKey: zOf.get(element.id) ?? -1,
      children: [],
      parentId: null,
    });
    pushChild(null, element.id);
  }

  // 元素节点
  for (const element of listed) {
    if (isFrameElement(element)) {
      continue;
    }
    nodes.set(element.id, {
      id: element.id,
      kind: "element",
      name: getElementDisplayName(element),
      hidden: !!element.hidden,
      locked: !!element.locked,
      elementIds: [element.id],
      zKey: zOf.get(element.id) ?? -1,
      children: [],
      parentId: null,
    });

    let parentId: string | null = null;
    if (element.groupIds.length) {
      parentId = element.groupIds[0];
      ensureGroupNode(parentId);
    } else if (element.frameId && frameIds.has(element.frameId)) {
      parentId = element.frameId;
    }
    nodes.get(element.id)!.parentId = parentId;
    pushChild(parentId, element.id);
  }

  // 分组节点的父容器：更外层的分组，否则取成员所在的画框
  for (const [id, node] of nodes) {
    if (node.kind !== "group") {
      continue;
    }
    let parentId: string | null = null;
    for (const element of listed) {
      const idx = element.groupIds.indexOf(id);
      if (idx === -1) {
        continue;
      }
      if (idx + 1 < element.groupIds.length) {
        parentId = element.groupIds[idx + 1];
        ensureGroupNode(parentId);
      } else if (element.frameId && frameIds.has(element.frameId)) {
        parentId = element.frameId;
      }
      break;
    }
    node.parentId = parentId;
    pushChild(parentId, id);
  }

  const isFullyHidden = (node: LayerNode): boolean =>
    node.hidden && node.children.every(isFullyHidden);

  // 自底向上汇总
  const build = (id: string): LayerNode => {
    const node = nodes.get(id)!;
    node.children = (childIds.get(id) ?? [])
      .map((childId) => nodes.get(childId)!)
      .sort((a, b) => b.zKey - a.zKey)
      .map((child) => build(child.id));

    const elementIds: string[] = [...node.elementIds];
    let zKey = node.zKey;
    for (const child of node.children) {
      elementIds.push(...child.elementIds);
      zKey = Math.max(zKey, child.zKey);
    }
    node.elementIds = elementIds;
    node.zKey = zKey;

    if (node.children.length) {
      node.hidden = node.children.every(isFullyHidden);
      node.locked = node.children.every((child) => child.locked);
      if (node.kind === "group") {
        const firstName = node.children[0]?.name ?? "";
        node.name =
          groupNames[node.id] || (firstName ? `${firstName} 组` : "分组");
      }
    }
    return node;
  };

  return (childIds.get("") ?? [])
    .map((id) => nodes.get(id)!)
    .sort((a, b) => {
      // 分组节点此时 zKey 仍为 -1，先用其成员的最大下标
      return maxZ(b) - maxZ(a);
    })
    .map((node) => build(node.id));

  function maxZ(node: LayerNode): number {
    if (node.kind !== "group") {
      return node.zKey;
    }
    let max = -1;
    for (const element of listed) {
      const idx = zOf.get(element.id) ?? -1;
      if (element.groupIds.includes(node.id)) {
        max = Math.max(max, idx);
      }
    }
    return max;
  }
};

/** 展开元素 id：绑定文字跟随其容器 */
const withBoundText = (
  elements: readonly ExcalidrawElement[],
  ids: Iterable<string>,
): Set<string> => {
  const result = new Set<string>(ids);
  for (const element of elements) {
    if (!result.has(element.id)) {
      continue;
    }
    const boundTextId = getBoundTextElementId(element);
    if (boundTextId) {
      result.add(boundTextId);
    }
  }
  return result;
};

const commitElements = (
  app: LayerApp,
  elements: readonly ExcalidrawElement[],
) => {
  app.updateScene({
    elements: syncInvalidIndices(elements),
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
};

export const setElementsHidden = (
  app: LayerApp,
  elementIds: Iterable<string>,
  hidden: boolean,
) => {
  const all = app.getSceneElementsIncludingDeleted();
  const target = withBoundText(all, elementIds);
  commitElements(
    app,
    all.map((element) =>
      target.has(element.id) && !!element.hidden !== hidden
        ? newElementWith(element, { hidden })
        : element,
    ),
  );
};

export const setElementsLocked = (
  app: LayerApp,
  elementIds: Iterable<string>,
  locked: boolean,
) => {
  const all = app.getSceneElementsIncludingDeleted();
  const target = withBoundText(all, elementIds);
  commitElements(
    app,
    all.map((element) =>
      target.has(element.id) && element.locked !== locked
        ? newElementWith(element, { locked })
        : element,
    ),
  );
};

export const renameElement = (
  app: LayerApp,
  elementId: string,
  name: string,
) => {
  const all = app.getSceneElementsIncludingDeleted();
  const trimmed = name.trim();
  commitElements(
    app,
    all.map((element) => {
      if (element.id !== elementId) {
        return element;
      }
      if (element.type === "frame" || element.type === "magicframe") {
        return newElementWith(element, { name: trimmed || null });
      }
      return newElementWith(element, { layerName: trimmed });
    }),
  );
};

export const deleteElements = (app: LayerApp, elementIds: Iterable<string>) => {
  const all = app.getSceneElementsIncludingDeleted();
  const target = withBoundText(all, elementIds);
  commitElements(
    app,
    all.map((element) =>
      target.has(element.id) && !element.isDeleted
        ? newElementWith(element, { isDeleted: true })
        : element,
    ),
  );
};

/**
 * 把一批元素移动到锚点元素的上方/下方（显示层语义）。
 * anchorId 为参照行所代表的元素；仅在同层之间使用。
 */
export const moveElements = (
  app: LayerApp,
  movingIds: Iterable<string>,
  anchorId: string,
  position: "above" | "below",
) => {
  const all = app.getSceneElementsIncludingDeleted();
  const movingSet = withBoundText(all, movingIds);
  const moving = all.filter((element) => movingSet.has(element.id));
  if (!moving.length) {
    return;
  }
  const rest = all.filter((element) => !movingSet.has(element.id));
  const anchorIndex = rest.findIndex((element) => element.id === anchorId);
  if (anchorIndex === -1) {
    return;
  }
  // 显示层"上方" = 更高 z = 数组更靠后
  const insertAt = position === "above" ? anchorIndex + 1 : anchorIndex;
  commitElements(app, [
    ...rest.slice(0, insertAt),
    ...moving,
    ...rest.slice(insertAt),
  ]);
};
