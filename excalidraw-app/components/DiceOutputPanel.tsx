import { useEffect, useRef, useState } from "react";

import "./DiceOutputPanel.scss";

import type { DesktopDiceOutputMessage } from "../global";

/** ARGB32 -> CSS 颜色，忽略透明度（与 gm_hub 的展示样式保持一致） */
const toCssColor = (argb: number) =>
  `#${(argb & 0xffffff).toString(16).padStart(6, "0")}`;

/**
 * 右下角骰子输出展示区。
 *
 * 只读：消息由 gm_hub 通过本地桥接推送，这里仅按到达顺序渲染。
 */
const DiceOutputPanel = () => {
  const [messages, setMessages] = useState<DesktopDiceOutputMessage[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onDiceOutput((next) =>
      setMessages(next),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (panel) {
      panel.scrollTop = panel.scrollHeight;
    }
  }, [messages]);

  if (!messages.length) {
    return null;
  }

  return (
    <div
      className="dice-output-panel"
      ref={panelRef}
      data-testid="dice-output-panel"
    >
      {messages.map((message, index) => (
        <div
          className="dice-output-panel__item"
          key={`${message.id}-${index}`}
          style={{ color: toCssColor(message.colorValue) }}
        >
          {message.text}
        </div>
      ))}
    </div>
  );
};

export default DiceOutputPanel;
