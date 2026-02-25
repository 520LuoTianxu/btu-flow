<template>
  <div class="page">
    <Toolbar @fit-view="triggerFitView" />
    <IOPanel />

    <section class="editor-wrap">
      <Palette />
      <FlowCanvas ref="flowCanvasRef" />
    </section>

    <NodeEditDrawer
      :visible="drawerVisible"
      :nodeData="drawerNodeData"
      @close="drawerVisible = false"
      @save="onDrawerSave"
    />
  </div>
</template>

<script setup>
import { ref } from "vue";
import Toolbar from "./components/Toolbar.vue";
import IOPanel from "./components/IOPanel.vue";
import Palette from "./components/Palette.vue";
import FlowCanvas from "./components/FlowCanvas.vue";
import NodeEditDrawer from "./components/NodeEditDrawer.vue";

import {
  drawerVisible,
  drawerNodeData,
  rawNodeMap,
  flowNodes,
  flowEdges,
  selectedNodeId,
} from "./store/flowStore.js";
import { nodeStyle } from "./utils/layout.js";

const flowCanvasRef = ref(null);

function triggerFitView() {
  flowCanvasRef.value?.exposeFitView();
}

function onDrawerSave(updatedData) {
  const oldName = drawerNodeData.value?.properties?.name;
  const newName = updatedData.properties?.name || oldName;

  if (oldName !== newName) {
    rawNodeMap.value.delete(oldName);
  }
  const fullRaw = { ...drawerNodeData.value };
  fullRaw.growthStageCode = updatedData.growthStageCode;
  fullRaw.properties = { ...fullRaw.properties, ...updatedData.properties };
  fullRaw.timeWindowParameterPOList = updatedData.timeWindowParameterPOList;
  if (updatedData.properties.btuConfig) {
    fullRaw.properties.btuConfig = updatedData.properties.btuConfig;
  }
  rawNodeMap.value.set(newName, fullRaw);

  flowNodes.value = flowNodes.value.map((n) => {
    if (n.id !== (oldName || "")) return n;
    const lineType =
      updatedData.properties?.lineType || n.data?.lineType || "fixed";
    return {
      ...n,
      id: newName,
      style: nodeStyle(lineType),
      data: {
        ...n.data,
        name: newName,
        growthStageCode: updatedData.growthStageCode || "-",
        operationTypeCode: updatedData.properties?.operationTypeCode || "-",
        lineType,
      },
    };
  });

  if (oldName !== newName) {
    flowEdges.value = flowEdges.value.map((e) => ({
      ...e,
      source: e.source === oldName ? newName : e.source,
      target: e.target === oldName ? newName : e.target,
    }));
    selectedNodeId.value = newName;
  }
  drawerVisible.value = false;
}
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.editor-wrap {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 12px;
  min-height: 66vh;
}

@media (max-width: 980px) {
  .editor-wrap {
    grid-template-columns: 1fr;
  }
}
</style>
