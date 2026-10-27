import {
  CaptureUpdateAction,
  computeBoundTextPosition,
  getBoundTextElement,
  getNonDeletedElements,
  getSelectedElements,
  isFrameLikeElement,
  updateBoundElements,
} from "@excalidraw/element";

import type { Radians } from "@excalidraw/math";

import { register } from "./register";

/**
 * 回正：将选中元素的角度重置为 0。
 * 容器回正后同步校正绑定文本的位置与角度，并刷新与其绑定的箭头。
 */
export const actionResetRotation = register({
  name: "resetRotation",
  label: "labels.resetRotation",
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
      { includeBoundTextElement: true },
    );

    const elementsMap = app.scene.getNonDeletedElementsMap();

    for (const element of selectedElements) {
      // 框架本身不支持旋转
      if (isFrameLikeElement(element) || element.angle === 0) {
        continue;
      }

      app.scene.mutateElement(element, { angle: 0 as Radians });
      updateBoundElements(element, app.scene);

      const boundText = getBoundTextElement(element, elementsMap);
      if (boundText) {
        const { x, y } = computeBoundTextPosition(
          element,
          boundText,
          elementsMap,
        );
        app.scene.mutateElement(boundText, { x, y, angle: 0 as Radians });
      }
    }

    return {
      elements,
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
