<template>
  <div class="flow-wrap" @dragover.prevent="onFlowDragOver" @drop="onFlowDrop">
    <VueFlow
      v-model:nodes="flowNodes"
      v-model:edges="flowEdges"
      class="btu-flow"
      :default-viewport="{ zoom: 1 }"
      :min-zoom="0.2"
      :max-zoom="2"
      :nodes-draggable="true"
      :nodes-connectable="true"
      :edges-updatable="true"
      :default-edge-options="defaultEdgeOptions"
      :fit-view-on-init="true"
      @pane-ready="onPaneReady"
      @pane-click="clearSelection"
      @connect="onConnect"
      @edge-update="onEdgeUpdate"
      @node-click="onNodeClick"
      @node-double-click="onNodeDoubleClick"
      @edge-click="onEdgeClick"
      @edge-double-click="onEdgeDoubleClick"
    >
      <template #node-default="{ data }">
        <Handle
          id="top-handle"
          type="target"
          :position="Position.Top"
          class="btu-handle"
        />
        <Handle
          id="bottom-handle"
          type="source"
          :position="Position.Bottom"
          class="btu-handle"
        />
        <Handle
          id="left-handle"
          type="target"
          :position="Position.Left"
          class="btu-handle"
        />
        <Handle
          id="right-handle"
          type="source"
          :position="Position.Right"
          class="btu-handle"
        />
        <div class="node-title">{{ data.name }}</div>
        <div class="node-meta">
          {{ data.growthStageCode || "-" }} ·
          {{ data.operationTypeCode || "-" }}
        </div>
      </template>
      <template #node-group-box="{ data }">
        <div class="group-box-label">{{ data.label }}</div>
      </template>
      <template #edge-smart="props">
        <BaseEdge
          :path="getSmartPath(props)[0]"
          :marker-end="props.markerEnd"
          :style="props.style"
          class="vue-flow__edge-path"
        />
        <EdgeLabelRenderer v-if="props.label">
          <div
            :style="{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${
                getSmartPath(props)[1]
              }px,${getSmartPath(props)[2]}px)`,
              pointerEvents: 'all',
              padding: '4px 8px',
              borderRadius: '4px',
              background: '#eef4fb',
              color: '#17324d',
              fontSize: '13px',
              fontWeight: 700,
            }"
            class="nodrag nopan"
            @click="(e) => onEdgeClick({ edge: props.edge, event: e })"
            @dblclick="(e) => onEdgeDoubleClick({ edge: props.edge, event: e })"
          >
            {{ props.label }}
          </div>
        </EdgeLabelRenderer>
      </template>
      <Background pattern-color="#d7e2ef" :gap="22" />
      <Controls position="top-right" />
    </VueFlow>
  </div>
</template>

<script setup>
import { computed } from "vue";
import {
  Handle,
  MarkerType,
  Position,
  VueFlow,
  useVueFlow,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
} from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import {
  flowNodes,
  flowEdges,
  rawNodeMap,
  nodeSeq,
  selectedNodeId,
  selectedEdgeId,
  clearSelection,
  drawerVisible,
  drawerNodeData,
  DRAG_NODE_MIME,
} from "../store/flowStore.js";
import { nodeStyle } from "../utils/layout.js";

const { addEdges, addNodes, fitView, screenToFlowCoordinate } = useVueFlow();

const defaultEdgeOptions = computed(() => ({
  type: "smart",
  markerEnd: MarkerType.ArrowClosed,
  style: { stroke: "#38557a", strokeWidth: 2 },
}));

function getSmartPath(props) {
  return getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
    centerX: props.data?.customCenterX,
    centerY: props.data?.customCenterY,
  });
}

function onPaneReady() {
  fitView({ padding: 0.2 });
}

function exposeFitView() {
  fitView({ padding: 0.2 });
}
defineExpose({ exposeFitView });

function openDrawer(nodeId) {
  const raw = rawNodeMap.value.get(nodeId);
  if (!raw) {
    alert("未找到节点原始数据");
    return;
  }
  drawerNodeData.value = raw;
  drawerVisible.value = true;
}

function onFlowDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function onFlowDrop(event) {
  event.preventDefault();
  const lineType = event.dataTransfer?.getData(DRAG_NODE_MIME);
  if (!lineType) return;
  const position = screenToFlowCoordinate({
    x: event.clientX,
    y: event.clientY,
  });
  const id = `新节点${nodeSeq.value++}`;
  const newRaw = {
    id: Date.now(),
    type: "btu-node",
    growthStageCode: "-",
    properties: {
      lineType,
      name: id,
      operationTypeCode: "custom",
      btuConfig: {
        btuTemplateAdmittanceConditionAGO: null,
        btuTemplateSubjectAGOList: [],
        corrections: [],
      },
    },
    timeWindowParameterPOList: [],
  };
  rawNodeMap.value.set(id, newRaw);
  addNodes([
    {
      id,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      position,
      style: nodeStyle(lineType),
      data: {
        name: id,
        growthStageCode: "-",
        operationTypeCode: "custom",
        lineType,
        leftHandleType: "target",
        rightHandleType: "source",
      },
    },
  ]);
}

function onConnect(connection) {
  addEdges([
    {
      ...connection,
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      type: "smart",
      updatable: true,
      label: "0天",
      labelStyle: { fill: "#17324d", fontSize: "13px", fontWeight: 700 },
      labelBgPadding: [8, 4],
      labelBgBorderRadius: 4,
      labelBgStyle: { fill: "#eef4fb", color: "#17324d" },
      style: { stroke: "#38557a", strokeWidth: 2 },
      markerEnd: MarkerType.ArrowClosed,
      data: { lineType: "fixed", daysText: "0天" },
    },
  ]);
}

function onNodeClick(event) {
  const nodeId = event?.node?.id || "";
  if (nodeId.startsWith("__group_")) return;
  selectedEdgeId.value = "";
  selectedNodeId.value = nodeId;
}
function onNodeDoubleClick(event) {
  const nodeId = event?.node?.id || "";
  if (!nodeId || nodeId.startsWith("__group_")) return;
  selectedEdgeId.value = "";
  selectedNodeId.value = nodeId;
  openDrawer(nodeId);
}
function onEdgeClick(event) {
  selectedNodeId.value = "";
  selectedEdgeId.value = event?.edge?.id || "";
}

function onEdgeUpdate(event) {
  const { edge, connection } = event || {};
  if (!edge || !connection?.source || !connection?.target) return;
  flowEdges.value = flowEdges.value.map((e) => {
    if (e.id !== edge.id) return e;
    return {
      ...e,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle || null,
      targetHandle: connection.targetHandle || null,
    };
  });
}

function onEdgeDoubleClick(event) {
  const edge = event?.edge;
  if (!edge) return;
  const current = String(edge.data?.daysText || edge.label || "0天").replace(
    "天",
    ""
  );
  const input = window.prompt("请输入天数（整数）", current);
  if (input == null) return;
  const days = Number(input);
  if (!Number.isFinite(days) || days < 0) {
    alert("请输入大于等于 0 的数字");
    return;
  }
  const daysText = `${Math.round(days)}天`;
  flowEdges.value = flowEdges.value.map((e) => {
    if (e.id !== edge.id) return e;
    return { ...e, label: daysText, data: { ...(e.data || {}), daysText } };
  });
}
</script>

<style scoped>
.flow-wrap {
  border: 1px solid #bfd0df;
  border-radius: 12px;
  overflow: hidden;
  background: #fcfeff;
}
.btu-flow {
  width: 100%;
  height: 66vh;
}
:deep(.vue-flow__node-default) {
  white-space: normal;
  text-align: left;
}
:deep(.vue-flow__node .node-title) {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
:deep(.vue-flow__node .node-meta) {
  margin-top: 8px;
  font-size: 12px;
  color: #4e647f;
}
:deep(.vue-flow__handle.btu-handle) {
  width: 12px;
  height: 12px;
  border: 2px solid #ffffff;
  background: #3d5f86;
  border-radius: 999px;
  opacity: 0.95;
}
:deep(.vue-flow__handle.btu-handle:hover) {
  transform: scale(1.2);
  background: #1b8bff;
}
:deep(.vue-flow__handle-connecting),
:deep(.vue-flow__handle.connecting) {
  background: #ff8a00 !important;
  box-shadow: 0 0 0 4px #ffd8a399;
}
:deep(.vue-flow__handle-valid),
:deep(.vue-flow__handle.valid) {
  background: #00a96b !important;
  box-shadow: 0 0 0 4px #8dffd899;
}
/* Group box */
.group-box-label {
  position: absolute;
  top: 8px;
  left: 16px;
  font-size: 14px;
  font-weight: 700;
  color: #2a6cb3;
  letter-spacing: 0.05em;
  pointer-events: none;
  user-select: none;
}

/* Selected node highlight */
:deep(.vue-flow__node.selected) {
  border-color: #ff8a00 !important;
  box-shadow: 0 0 0 3px rgba(255, 138, 0, 0.3),
    0 4px 16px rgba(255, 138, 0, 0.15) !important;
  transform: scale(1.02);
  transition: all 0.15s ease;
  z-index: 10 !important;
}

/* Selected edge highlight */
:deep(.vue-flow__edge.selected .vue-flow__edge-path) {
  stroke: #ff8a00 !important;
  stroke-width: 3 !important;
  filter: drop-shadow(0 0 4px rgba(255, 138, 0, 0.4));
}
:deep(.vue-flow__edge.selected .vue-flow__edge-textbg) {
  fill: #fff3e0 !important;
}
:deep(.vue-flow__edge.selected .vue-flow__edge-text) {
  fill: #ff8a00 !important;
}

/* Edge hover */
:deep(.vue-flow__edge:hover .vue-flow__edge-path) {
  stroke: #2a6cb3 !important;
  stroke-width: 2.5 !important;
  cursor: pointer;
}

/* Arrow markers visible */
:deep(.vue-flow__marker) {
  fill: #38557a;
}
:deep(.vue-flow__edge.selected .vue-flow__marker) {
  fill: #ff8a00;
}

@media (max-width: 980px) {
  .btu-flow {
    height: 58vh;
  }
}
</style>
