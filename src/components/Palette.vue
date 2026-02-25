<template>
  <aside class="palette">
    <p class="palette-title">节点面板</p>
    <div
      class="palette-item solid"
      draggable="true"
      @dragstart="onPaletteDragStart($event, 'fixed')"
    >
      拖拽新增实线节点
    </div>
    <div
      class="palette-item dash"
      draggable="true"
      @dragstart="onPaletteDragStart($event, 'dynamic')"
    >
      拖拽新增虚线节点
    </div>
    <p class="palette-note">拖到画布后可拉线连接。点击节点打开编辑器。</p>

    <div class="inspector">
      <p class="palette-title">属性编辑</p>
      <template v-if="selectedNode">
        <p class="inspect-type">当前选中: 节点</p>
        <label class="field">
          <span>节点名称</span>
          <input
            :value="selectedNode.data?.name || ''"
            @change="updateSelectedNode({ name: $event.target.value })"
          />
        </label>
        <label class="field">
          <span>生育阶段</span>
          <input
            :value="selectedNode.data?.growthStageCode || ''"
            @input="
              updateSelectedNode({ growthStageCode: $event.target.value })
            "
          />
        </label>
        <label class="field">
          <span>作业类型</span>
          <input
            :value="selectedNode.data?.operationTypeCode || ''"
            @input="
              updateSelectedNode({ operationTypeCode: $event.target.value })
            "
          />
        </label>
        <label class="field">
          <span>线型</span>
          <select
            :value="selectedNode.data?.lineType || 'fixed'"
            @change="updateSelectedNode({ lineType: $event.target.value })"
          >
            <option value="fixed">fixed(实线)</option>
            <option value="dynamic">dynamic(虚线)</option>
          </select>
        </label>
        <button class="edit-detail-btn" @click="openDrawer(selectedNodeId)">
          📝 编辑全部配置
        </button>
      </template>

      <template v-else-if="selectedEdge">
        <p class="inspect-type">当前选中: 连线</p>
        <label class="field">
          <span>时间天数</span>
          <input
            :value="selectedEdge.data?.daysText?.replace('天', '') || '0'"
            @input="updateSelectedEdgeDays($event.target.value)"
          />
        </label>
        <label class="field">
          <span>线型</span>
          <select
            :value="selectedEdge.data?.lineType || 'fixed'"
            @change="updateSelectedEdgeType($event.target.value)"
          >
            <option value="fixed">fixed(实线)</option>
            <option value="dynamic">dynamic(虚线)</option>
          </select>
        </label>
      </template>

      <p v-else class="palette-note">点击节点或连线后可编辑属性。</p>
    </div>
  </aside>
</template>

<script setup>
import {
  selectedNode,
  selectedNodeId,
  selectedEdge,
  selectedEdgeId,
  flowNodes,
  flowEdges,
  rawNodeMap,
  drawerNodeData,
  drawerVisible,
  buildUniqueNodeId,
  DRAG_NODE_MIME,
} from "../store/flowStore.js";
import { nodeStyle, edgeStyle } from "../utils/layout.js";

function openDrawer(nodeId) {
  const raw = rawNodeMap.value.get(nodeId);
  if (!raw) {
    alert("未找到节点原始数据");
    return;
  }
  drawerNodeData.value = raw;
  drawerVisible.value = true;
}

function updateSelectedNode(patch) {
  if (!selectedNodeId.value) return;
  const oldId = selectedNodeId.value;
  if (typeof patch.name === "string") {
    const trimmed = patch.name.trim();
    if (trimmed && trimmed !== oldId) {
      const nextId = buildUniqueNodeId(trimmed, oldId);
      const raw = rawNodeMap.value.get(oldId);
      if (raw) {
        rawNodeMap.value.delete(oldId);
        raw.properties.name = nextId;
        rawNodeMap.value.set(nextId, raw);
      }
      flowNodes.value = flowNodes.value.map((n) => {
        if (n.id !== oldId) return n;
        const nextLineType = patch.lineType || n.data?.lineType || "fixed";
        return {
          ...n,
          id: nextId,
          style: nodeStyle(nextLineType),
          data: { ...(n.data || {}), ...patch, name: nextId },
        };
      });
      flowEdges.value = flowEdges.value.map((e) => ({
        ...e,
        source: e.source === oldId ? nextId : e.source,
        target: e.target === oldId ? nextId : e.target,
      }));
      selectedNodeId.value = nextId;
      return;
    }
  }

  const raw = rawNodeMap.value.get(oldId);
  if (raw) {
    if (patch.growthStageCode !== undefined)
      raw.growthStageCode = patch.growthStageCode;
    if (patch.operationTypeCode !== undefined && raw.properties)
      raw.properties.operationTypeCode = patch.operationTypeCode;
    if (patch.lineType !== undefined && raw.properties)
      raw.properties.lineType = patch.lineType;
  }
  flowNodes.value = flowNodes.value.map((n) => {
    if (n.id !== oldId) return n;
    const lineType = patch.lineType || n.data?.lineType || "fixed";
    return {
      ...n,
      style: nodeStyle(lineType),
      data: { ...(n.data || {}), ...patch },
    };
  });
}

function updateSelectedEdgeType(lineType) {
  if (!selectedEdgeId.value) return;
  flowEdges.value = flowEdges.value.map((e) => {
    if (e.id !== selectedEdgeId.value) return e;
    return {
      ...e,
      style: edgeStyle(lineType),
      data: { ...(e.data || {}), lineType },
    };
  });
}

function updateSelectedEdgeDays(rawValue) {
  if (!selectedEdgeId.value) return;
  const parsed = Number(rawValue);
  const days = Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
  const daysText = `${days}天`;
  flowEdges.value = flowEdges.value.map((e) => {
    if (e.id !== selectedEdgeId.value) return e;
    return { ...e, label: daysText, data: { ...(e.data || {}), daysText } };
  });
}

function onPaletteDragStart(event, lineType) {
  event.dataTransfer?.setData(DRAG_NODE_MIME, lineType);
  event.dataTransfer.effectAllowed = "move";
}
</script>

<style scoped>
.palette {
  border: 1px solid #bfd0df;
  border-radius: 12px;
  background: #f9fcff;
  padding: 12px;
}
.palette-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
}
.palette-item {
  border: 2px solid #3d5f86;
  border-radius: 10px;
  padding: 12px 10px;
  background: #fff;
  margin-bottom: 10px;
  cursor: grab;
  user-select: none;
  font-size: 13px;
}
.palette-item.dash {
  border-style: dashed;
}
.palette-note {
  margin: 6px 0 0;
  font-size: 12px;
  color: #4e647f;
}
.inspector {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed #c2cfde;
}
.inspect-type {
  margin: 0 0 8px;
  font-size: 12px;
  color: #2d4763;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 8px;
}
.field span {
  font-size: 12px;
  color: #405b78;
}
.field input,
.field select {
  border: 1px solid #b8c7d7;
  border-radius: 8px;
  padding: 7px 8px;
  font-size: 13px;
  background: #fff;
}
.edit-detail-btn {
  margin-top: 8px;
  width: 100%;
  padding: 9px;
  border: 2px solid #1a5296;
  border-radius: 8px;
  background: linear-gradient(135deg, #edf4fc, #dde9f6);
  color: #1a5296;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.edit-detail-btn:hover {
  background: linear-gradient(135deg, #1a5296, #2a7de1);
  color: #fff;
}
</style>
