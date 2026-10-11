import {
  useExcalidrawElements,
  useExcalidrawSetAppState,
} from "@excalidraw/excalidraw/components/App";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";

import React, { useMemo, useRef, useState } from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  buildLayerTree,
  deleteElements,
  moveElements,
  renameElement,
  setElementsHidden,
  setElementsLocked,
} from "./layers";

import "./LayerPanel.scss";

import type { LayerNode } from "./layers";

const TYPE_BADGES: Record<string, string> = {
  rectangle: "矩",
  diamond: "菱",
  ellipse: "圆",
  arrow: "箭",
  line: "线",
  freedraw: "笔",
  text: "文",
  image: "图",
  frame: "框",
  magicframe: "框",
  embeddable: "嵌",
  iframe: "网",
};

const EyeIcon = ({ off }: { off: boolean }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    {off ? (
      <path
        d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M6.6 6.6C4.6 7.9 3 10 2 12c2 4 6 7 10 7 1.7 0 3.3-.5 4.7-1.3M9.9 5.2A11 11 0 0112 5c4 0 8 3 10 7-.7 1.3-1.6 2.5-2.7 3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    ) : (
      <path
        d="M2 12c2-4 6-7 10-7s8 3 10 7c-2 4-6 7-10 7s-8-3-10-7z M12 9a3 3 0 100 6 3 3 0 000-6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    )}
  </svg>
);

const LockIcon = ({ locked }: { locked: boolean }) => (
  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
    <rect
      x="5"
      y="11"
      width="14"
      height="9"
      rx="2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    {locked ? (
      <path
        d="M8 11V8a4 4 0 018 0v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    ) : (
      <path
        d="M8 11V8a4 4 0 016.9-2.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    )}
  </svg>
);

const ChevronIcon = ({ collapsed }: { collapsed: boolean }) => (
  <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
    <path
      d={collapsed ? "M9 6l6 6-6 6" : "M6 9l6 6 6-6"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const findSiblings = (
  tree: LayerNode[],
  nodeId: string,
): LayerNode[] | null => {
  if (tree.some((node) => node.id === nodeId)) {
    return tree;
  }
  for (const node of tree) {
    const found = findSiblings(node.children, nodeId);
    if (found) {
      return found;
    }
  }
  return null;
};

export const LayerPanel: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI;
}> = ({ excalidrawAPI }) => {
  const elements = useExcalidrawElements();
  const appState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    node: LayerNode;
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: "above" | "below";
  } | null>(null);
  const draggingRef = useRef<LayerNode | null>(null);

  const elementById = useMemo(
    () => new Map(elements.map((element) => [element.id, element])),
    [elements],
  );
  const tree = useMemo(
    () => buildLayerTree(elements, appState.groupNames),
    [elements, appState.groupNames],
  );

  const badgeOf = (node: LayerNode, element?: ExcalidrawElement) => {
    if (node.kind === "group") {
      return "组";
    }
    if (node.kind === "frame") {
      return "框";
    }
    return element ? TYPE_BADGES[element.type] ?? "元" : "元";
  };

  const isSelected = (node: LayerNode) =>
    node.elementIds.some((id) => appState.selectedElementIds[id]);

  const handleSelect = (node: LayerNode, event: React.MouseEvent) => {
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    const selectedElementIds: Record<string, true> = additive
      ? { ...appState.selectedElementIds }
      : {};
    for (const id of node.elementIds) {
      selectedElementIds[id] = true;
    }
    const selectedGroupIds =
      node.kind === "group"
        ? { ...(additive ? appState.selectedGroupIds : {}), [node.id]: true }
        : additive
        ? appState.selectedGroupIds
        : {};
    setAppState({ selectedElementIds, selectedGroupIds });
  };

  const toggleHidden = (node: LayerNode) =>
    setElementsHidden(excalidrawAPI, node.elementIds, !node.hidden);

  const toggleLocked = (node: LayerNode) =>
    setElementsLocked(excalidrawAPI, node.elementIds, !node.locked);

  // 分组名称存在 appState.groupNames（随文件导出），其余元素写在自身字段上
  const commitRename = (node: LayerNode, value: string) => {
    if (node.kind !== "group") {
      renameElement(excalidrawAPI, node.id, value);
      return;
    }
    const trimmed = value.trim();
    const groupNames = { ...appState.groupNames };
    if (trimmed) {
      groupNames[node.id] = trimmed;
    } else {
      delete groupNames[node.id];
    }
    setAppState({ groupNames });
  };

  const handleDelete = (node: LayerNode) => {
    const label =
      node.kind === "element" ? node.name : `${node.name}（含全部子层）`;
    if (node.kind === "element" || window.confirm(`删除「${label}」？`)) {
      deleteElements(excalidrawAPI, node.elementIds);
    }
  };

  const anchorOf = (node: LayerNode, position: "above" | "below") => {
    const indexById = new Map(
      elements.map((element, index) => [element.id, index]),
    );
    let best = node.elementIds[0];
    for (const id of node.elementIds) {
      const current = indexById.get(id) ?? -1;
      const bestIndex = indexById.get(best) ?? -1;
      if (position === "above" ? current > bestIndex : current < bestIndex) {
        best = id;
      }
    }
    return best;
  };

  const moveSibling = (
    node: LayerNode,
    direction: "up" | "down" | "top" | "bottom",
  ) => {
    const siblings = findSiblings(tree, node.id);
    if (!siblings) {
      return;
    }
    const index = siblings.findIndex((sibling) => sibling.id === node.id);
    let target: LayerNode | undefined;
    let position: "above" | "below" = "above";
    if (direction === "up") {
      target = siblings[index - 1];
      position = "above";
    } else if (direction === "down") {
      target = siblings[index + 1];
      position = "below";
    } else if (direction === "top") {
      target = siblings[0];
      position = "above";
    } else {
      target = siblings[siblings.length - 1];
      position = "below";
    }
    if (!target || target.id === node.id) {
      return;
    }
    moveElements(
      excalidrawAPI,
      node.elementIds,
      anchorOf(target, position),
      position,
    );
  };

  const commitDrop = (target: LayerNode) => {
    const dragging = draggingRef.current;
    const position = dropTarget?.position ?? "above";
    draggingRef.current = null;
    setDropTarget(null);
    if (!dragging || dragging.id === target.id) {
      return;
    }
    moveElements(
      excalidrawAPI,
      dragging.elementIds,
      anchorOf(target, position),
      position,
    );
  };

  const canDropOn = (target: LayerNode) => {
    const dragging = draggingRef.current;
    if (!dragging || dragging.id === target.id) {
      return false;
    }
    if (dragging.parentId !== target.parentId) {
      return false;
    }
    return !target.elementIds.some((id) => dragging.elementIds.includes(id));
  };

  const renderRow = (node: LayerNode, depth: number): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isCollapsed = !!collapsed[node.id];
    const element = elementById.get(node.id);
    const selected = isSelected(node);
    const isDropTarget = dropTarget?.id === node.id;

    return (
      <div key={node.id}>
        <div
          className={[
            "layer-row",
            selected ? "is-selected" : "",
            node.hidden ? "is-hidden" : "",
            isDropTarget && dropTarget?.position === "above"
              ? "is-drop-above"
              : "",
            isDropTarget && dropTarget?.position === "below"
              ? "is-drop-below"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ paddingLeft: 4 + depth * 14 }}
          draggable={editingId !== node.id}
          onDragStart={(event) => {
            draggingRef.current = node;
            setDropTarget(null);
            event.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => {
            draggingRef.current = null;
            setDropTarget(null);
          }}
          onDragOver={(event) => {
            if (!canDropOn(node)) {
              return;
            }
            event.preventDefault();
            const rect = event.currentTarget.getBoundingClientRect();
            setDropTarget({
              id: node.id,
              position:
                event.clientY < rect.top + rect.height / 2 ? "above" : "below",
            });
          }}
          onDrop={(event) => {
            event.preventDefault();
            commitDrop(node);
          }}
          onClick={(event) => {
            if (editingId === node.id) {
              return;
            }
            handleSelect(node, event);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            setMenu({ x: event.clientX, y: event.clientY, node });
          }}
        >
          <button
            type="button"
            className="layer-row__chevron"
            onClick={(event) => {
              event.stopPropagation();
              setCollapsed((prev) => ({ ...prev, [node.id]: !prev[node.id] }));
            }}
          >
            {hasChildren ? <ChevronIcon collapsed={isCollapsed} /> : null}
          </button>
          <button
            type="button"
            className="layer-row__eye"
            title={node.hidden ? "显示" : "隐藏"}
            onClick={(event) => {
              event.stopPropagation();
              toggleHidden(node);
            }}
          >
            <EyeIcon off={node.hidden} />
          </button>
          <span className={`layer-row__badge layer-row__badge--${node.kind}`}>
            {badgeOf(node, element)}
          </span>
          {editingId === node.id ? (
            <input
              className="layer-row__name-input"
              defaultValue={node.name}
              autoFocus
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitRename(node, event.currentTarget.value);
                  setEditingId(null);
                } else if (event.key === "Escape") {
                  setEditingId(null);
                }
              }}
              onBlur={(event) => {
                commitRename(node, event.target.value);
                setEditingId(null);
              }}
            />
          ) : (
            <span
              className="layer-row__name"
              title={node.name}
              onDoubleClick={(event) => {
                event.stopPropagation();
                setEditingId(node.id);
              }}
            >
              {node.name}
            </span>
          )}
          <button
            type="button"
            className="layer-row__lock"
            title={node.locked ? "解锁" : "锁定"}
            onClick={(event) => {
              event.stopPropagation();
              toggleLocked(node);
            }}
          >
            <LockIcon locked={node.locked} />
          </button>
        </div>
        {hasChildren && !isCollapsed
          ? node.children.map((child) => renderRow(child, depth + 1))
          : null}
      </div>
    );
  };

  return (
    <div className="layer-panel">
      {elements.length > 500 ? (
        <div className="layer-panel__warning">
          元素较多（{elements.length}），面板可能变慢
        </div>
      ) : null}
      {tree.length === 0 ? (
        <div className="layer-panel__empty">画布还没有内容</div>
      ) : (
        <div className="layer-panel__list">
          {tree.map((node) => renderRow(node, 0))}
        </div>
      )}

      {menu ? (
        <>
          <div className="layer-menu__backdrop" onClick={() => setMenu(null)} />
          <div
            className="layer-menu"
            style={{ left: menu.x, top: menu.y }}
            onContextMenu={(event) => event.preventDefault()}
          >
            <button
              type="button"
              onClick={() => {
                setEditingId(menu.node.id);
                setMenu(null);
              }}
            >
              重命名
            </button>
            <button
              type="button"
              onClick={() => {
                moveSibling(menu.node, "up");
                setMenu(null);
              }}
            >
              上移
            </button>
            <button
              type="button"
              onClick={() => {
                moveSibling(menu.node, "down");
                setMenu(null);
              }}
            >
              下移
            </button>
            <button
              type="button"
              onClick={() => {
                moveSibling(menu.node, "top");
                setMenu(null);
              }}
            >
              置顶
            </button>
            <button
              type="button"
              onClick={() => {
                moveSibling(menu.node, "bottom");
                setMenu(null);
              }}
            >
              置底
            </button>
            <div className="layer-menu__separator" />
            <button
              type="button"
              onClick={() => {
                toggleHidden(menu.node);
                setMenu(null);
              }}
            >
              {menu.node.hidden ? "全部显示" : "全部隐藏"}
            </button>
            <button
              type="button"
              className="is-danger"
              onClick={() => {
                handleDelete(menu.node);
                setMenu(null);
              }}
            >
              删除
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
};
