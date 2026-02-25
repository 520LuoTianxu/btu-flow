<template>
  <div class="page">
    <header class="toolbar">
      <div class="left-actions">
        <label class="file-btn">
          上传 JSON
          <input
            type="file"
            accept="application/json,.json"
            @change="onFileUpload"
          />
        </label>
        <button @click="generateFromInput">一键生成</button>
        <button @click="sortLayout" :disabled="flowNodes.length === 0">
          一键排序
        </button>
        <button @click="fitCurrentView" :disabled="flowNodes.length === 0">
          适配视图
        </button>
        <button @click="exportAll" :disabled="flowNodes.length === 0">
          导出 flowConfig + flowLayout
        </button>
      </div>
      <span class="tips"
        >点击节点可编辑全部配置数据；双击边可编辑天数；导出后保存为 flowConfig
        与 flowLayout</span
      >
    </header>

    <section class="io-panel">
      <textarea
        v-model="jsonInput"
        placeholder="粘贴 flowConfig JSON，或上传文件后自动填充"
      />
      <textarea
        v-model="exportText"
        readonly
        placeholder="导出的 flowConfig + flowLayout JSON 会显示在这里"
      />
    </section>

    <section class="editor-wrap">
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

      <div
        class="flow-wrap"
        @dragover.prevent="onFlowDragOver"
        @drop="onFlowDrop"
      >
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
          <Background pattern-color="#d7e2ef" :gap="22" />
          <Controls position="top-right" />
        </VueFlow>
      </div>
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
import { computed, nextTick, ref } from "vue";
import {
  Handle,
  MarkerType,
  Position,
  VueFlow,
  useVueFlow,
} from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import NodeEditDrawer from "./components/NodeEditDrawer.vue";
import dagre from "@dagrejs/dagre";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 88;
const X_GAP = 240;
const Y_GAP = 34;
const COMPACT_X_GAP = 140;
const COMPACT_Y_GAP = 26;
const PADDING = 48;
const DRAG_NODE_MIME = "application/x-btu-node";

const jsonInput = ref("");
const exportText = ref("");
const flowNodes = ref([]);
const flowEdges = ref([]);
const nodeSeq = ref(1);
const selectedNodeId = ref("");
const selectedEdgeId = ref("");

// Raw data maps - store the original JSON data for each node/edge by name
const rawNodeMap = ref(new Map());
const rawEdgeList = ref([]);

// Drawer state
const drawerVisible = ref(false);
const drawerNodeData = ref(null);

const { addEdges, addNodes, fitView, screenToFlowCoordinate } = useVueFlow();

const defaultEdgeOptions = computed(() => ({
  type: "smoothstep",
  markerEnd: MarkerType.ArrowClosed,
  style: { stroke: "#38557a", strokeWidth: 2 },
}));
const selectedNode = computed(() =>
  flowNodes.value.find((n) => n.id === selectedNodeId.value)
);
const selectedEdge = computed(() =>
  flowEdges.value.find((e) => e.id === selectedEdgeId.value)
);

function safeParse(inputText) {
  const parsed = JSON.parse(inputText);
  const flowConfig = parsed?.flowConfig ?? parsed;
  const nodeList = Array.isArray(flowConfig?.nodes) ? flowConfig.nodes : [];
  const edgeList = Array.isArray(flowConfig?.edges) ? flowConfig.edges : [];
  if (nodeList.length === 0) throw new Error("nodes 为空，无法生成布局");
  return { nodeList, edgeList };
}

function parseEdgeDays(edgeRaw) {
  const list = edgeRaw?.properties?.timeWindowParameterPOList;
  if (!Array.isArray(list) || list.length === 0) return "0天";
  const first = list[0] || {};
  const min = Number(first.minValue);
  const max = Number(first.maxValue);
  if (Number.isFinite(min) && Number.isFinite(max)) {
    return min === max ? `${min}天` : `${min}-${max}天`;
  }
  return "0天";
}

function nodeStyle(lineType) {
  return {
    width: `${NODE_WIDTH}px`,
    minHeight: `${NODE_HEIGHT}px`,
    borderRadius: "10px",
    border: "2px solid #3d5f86",
    borderStyle: lineType === "dynamic" ? "dashed" : "solid",
    background: "#fff",
    boxShadow: "0 5px 12px #d9e4ef",
    padding: "10px 12px",
  };
}

function edgeStyle(lineType) {
  return {
    stroke: "#38557a",
    strokeWidth: 2,
    strokeDasharray: lineType === "dynamic" ? "8 5" : "0",
  };
}

function openDrawer(nodeId) {
  const raw = rawNodeMap.value.get(nodeId);
  if (!raw) {
    alert("未找到节点原始数据");
    return;
  }
  drawerNodeData.value = raw;
  drawerVisible.value = true;
}

function onDrawerSave(updatedData) {
  const oldName = drawerNodeData.value?.properties?.name;
  const newName = updatedData.properties?.name || oldName;

  // Update raw data map
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

  // Update flow node visual
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

function buildLayout(nodeList, edgeList) {
  const byName = new Map();
  nodeList.forEach((n, index) => {
    const name = n?.properties?.name || `node_${index}`;
    byName.set(name, {
      name,
      growthStageCode: n.growthStageCode || "OTHER",
      operationTypeCode: n?.properties?.operationTypeCode || "",
      lineType: n?.properties?.lineType || "fixed",
    });
  });

  const normalizedEdges = edgeList
    .filter(
      (e) =>
        byName.has(e.fromBtuTemplateName) && byName.has(e.toBtuTemplateName)
    )
    .map((e, idx) => ({
      id: e.id || `e-${e.fromBtuTemplateName}-${e.toBtuTemplateName}-${idx}`,
      source: e.fromBtuTemplateName,
      target: e.toBtuTemplateName,
      lineType: e?.properties?.lineType || "fixed",
      daysText: parseEdgeDays(e),
    }));

  const selfLoops = normalizedEdges.filter((e) => e.source === e.target);
  const normalEdges = normalizedEdges.filter((e) => e.source !== e.target);

  // === 1. Group by growthStageCode ===
  const groups = new Map();
  byName.forEach((info, name) => {
    const gc = info.growthStageCode;
    if (!groups.has(gc)) groups.set(gc, []);
    groups.get(gc).push(name);
  });
  const nodeToGroup = new Map();
  byName.forEach((info, name) => nodeToGroup.set(name, info.growthStageCode));

  // === 2. Layout WITHIN each group using dagre ===
  const groupInternalPositions = new Map(); // name -> {x, y} relative to group top-left
  const groupSizes = new Map(); // gc -> {width, height}
  const GROUP_PAD = 36;
  const GROUP_LABEL_H = 36;

  groups.forEach((members, gc) => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "LR", nodesep: 100, ranksep: 140, edgesep: 60 });
    g.setDefaultEdgeLabel(() => ({}));

    members.forEach((name) => {
      g.setNode(name, { width: NODE_WIDTH, height: NODE_HEIGHT });
    });

    const memberSet = new Set(members);
    normalEdges.forEach((e) => {
      if (memberSet.has(e.source) && memberSet.has(e.target)) {
        g.setEdge(e.source, e.target);
      }
    });

    dagre.layout(g);

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    g.nodes().forEach((id) => {
      const n = g.node(id);
      const x = n.x - NODE_WIDTH / 2;
      const y = n.y - NODE_HEIGHT / 2;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + NODE_WIDTH);
      maxY = Math.max(maxY, y + NODE_HEIGHT);
    });

    // Store relative positions (offset so group starts at 0,0)
    g.nodes().forEach((id) => {
      const n = g.node(id);
      groupInternalPositions.set(id, {
        x: n.x - NODE_WIDTH / 2 - minX + GROUP_PAD,
        y: n.y - NODE_HEIGHT / 2 - minY + GROUP_PAD + GROUP_LABEL_H,
      });
    });

    groupSizes.set(gc, {
      width: maxX - minX + GROUP_PAD * 2,
      height: maxY - minY + GROUP_PAD * 2 + GROUP_LABEL_H,
    });
  });

  // === 3. Layout GROUPS as super-nodes using dagre ===
  const gg = new dagre.graphlib.Graph();
  gg.setGraph({ rankdir: "TB", nodesep: 120, ranksep: 160, edgesep: 80 });
  gg.setDefaultEdgeLabel(() => ({}));

  groups.forEach((_, gc) => {
    const sz = groupSizes.get(gc);
    gg.setNode(gc, { width: sz.width, height: sz.height });
  });

  // Add inter-group edges (deduplicated)
  const interGroupEdgeSet = new Set();
  normalEdges.forEach((e) => {
    const gS = nodeToGroup.get(e.source);
    const gT = nodeToGroup.get(e.target);
    if (gS !== gT) {
      const key = `${gS}|${gT}`;
      if (!interGroupEdgeSet.has(key)) {
        interGroupEdgeSet.add(key);
        gg.setEdge(gS, gT);
      }
    }
  });

  dagre.layout(gg);

  // Get group top-left positions
  const groupPositions = new Map();
  gg.nodes().forEach((gc) => {
    const n = gg.node(gc);
    const sz = groupSizes.get(gc);
    groupPositions.set(gc, {
      x: n.x - sz.width / 2,
      y: n.y - sz.height / 2,
    });
  });

  // === 4. Compute final absolute positions ===
  const absolutePositions = new Map();
  byName.forEach((_, name) => {
    const gc = nodeToGroup.get(name);
    const gp = groupPositions.get(gc);
    const ip = groupInternalPositions.get(name);
    absolutePositions.set(name, { x: gp.x + ip.x, y: gp.y + ip.y });
  });

  // === 5. Build output ===
  const nodes = [];

  // Group boxes
  groupPositions.forEach((pos, gc) => {
    const sz = groupSizes.get(gc);
    nodes.push({
      id: `__group_${gc}`,
      type: "group-box",
      position: { x: pos.x, y: pos.y },
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
      style: {
        width: `${sz.width}px`,
        height: `${sz.height}px`,
        borderRadius: "14px",
        border: "2px solid #b8d4ef",
        background: "rgba(220, 235, 252, 0.35)",
        padding: "0",
        zIndex: 0,
        pointerEvents: "none",
      },
      data: { label: gc, isGroup: true },
    });
  });

  // Real nodes
  byName.forEach((info, name) => {
    const pos = absolutePositions.get(name);
    nodes.push({
      id: name,
      type: "default",
      position: { x: pos.x, y: pos.y },
      style: nodeStyle(info.lineType),
      data: {
        name,
        growthStageCode: info.growthStageCode || "-",
        operationTypeCode: info.operationTypeCode || "-",
        lineType: info.lineType,
      },
    });
  });

  // === 6. Edges with smart handle selection ===
  const posMap = absolutePositions;

  const edges = normalEdges.map((e) => {
    const isDynamic = e.lineType === "dynamic";
    const srcPos = posMap.get(e.source);
    const tgtPos = posMap.get(e.target);

    let sourceHandle = "bottom-handle";
    let targetHandle = "top-handle";

    if (srcPos && tgtPos) {
      const isSameGroup =
        nodeToGroup.get(e.source) === nodeToGroup.get(e.target);
      if (isSameGroup) {
        sourceHandle = srcPos.x > tgtPos.x ? "left-handle" : "right-handle";
        targetHandle = srcPos.x > tgtPos.x ? "right-handle" : "left-handle";
      } else {
        sourceHandle = srcPos.y > tgtPos.y ? "top-handle" : "bottom-handle";
        targetHandle = srcPos.y > tgtPos.y ? "bottom-handle" : "top-handle";
      }
    }

    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle,
      targetHandle,
      type: "smoothstep",
      updatable: true,
      label: e.daysText,
      labelStyle: { fill: "#17324d", fontSize: "13px", fontWeight: 700 },
      labelBgPadding: [8, 4],
      labelBgBorderRadius: 4,
      labelBgStyle: { fill: "#eef4fb", color: "#17324d" },
      style: { ...edgeStyle(isDynamic ? "dynamic" : "fixed") },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "#38557a",
        width: 20,
        height: 20,
      },
      data: { lineType: e.lineType, daysText: e.daysText },
    };
  });

  // Self-loops: top → right
  selfLoops.forEach((e) => {
    const isDynamic = e.lineType === "dynamic";
    edges.push({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: "top-handle",
      targetHandle: "right-handle",
      type: "smoothstep",
      updatable: true,
      label: e.daysText,
      labelStyle: { fill: "#17324d", fontSize: "13px", fontWeight: 700 },
      labelBgPadding: [8, 4],
      labelBgBorderRadius: 4,
      labelBgStyle: { fill: "#eef4fb", color: "#17324d" },
      style: { ...edgeStyle(isDynamic ? "dynamic" : "fixed") },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "#38557a",
        width: 20,
        height: 20,
      },
      data: { lineType: e.lineType, daysText: e.daysText },
    });
  });

  return { nodes, edges };
}

async function generateFromInput() {
  try {
    const { nodeList, edgeList } = safeParse(jsonInput.value);
    // Store raw node data by name
    const newMap = new Map();
    nodeList.forEach((n, idx) => {
      const name = n?.properties?.name || `node_${idx}`;
      newMap.set(name, JSON.parse(JSON.stringify(n)));
    });
    rawNodeMap.value = newMap;
    rawEdgeList.value = JSON.parse(JSON.stringify(edgeList));

    const { nodes, edges } = buildLayout(nodeList, edgeList);
    flowNodes.value = nodes;
    flowEdges.value = edges;
    exportText.value = "";
    await nextTick();
    fitView({ padding: 0.2, includeHiddenNodes: false });
  } catch (error) {
    alert(`解析失败：${error.message}`);
  }
}

async function sortLayout() {
  if (flowNodes.value.length === 0) return;
  const nodeList = flowNodes.value
    .filter((n) => !n.id.startsWith("__group_"))
    .map((n) => ({
      growthStageCode: n.data?.growthStageCode || "",
      properties: {
        name: n.id,
        operationTypeCode: n.data?.operationTypeCode || "",
        lineType: n.data?.lineType || "fixed",
      },
    }));
  const edgeList = flowEdges.value.map((e) => {
    const days = String(e.data?.daysText || e.label || "0天").replace("天", "");
    const numeric = Number(days);
    const value = Number.isFinite(numeric) ? numeric : 0;
    return {
      fromBtuTemplateName: e.source,
      toBtuTemplateName: e.target,
      properties: {
        lineType: e.data?.lineType || "fixed",
        timeWindowParameterPOList: [{ minValue: value, maxValue: value }],
      },
    };
  });
  const { nodes } = buildLayout(nodeList, edgeList);
  flowNodes.value = nodes.map((n) => {
    const cur = flowNodes.value.find((x) => x.id === n.id);
    return {
      ...n,
      data: {
        ...n.data,
        growthStageCode: cur?.data?.growthStageCode || n.data.growthStageCode,
        operationTypeCode:
          cur?.data?.operationTypeCode || n.data.operationTypeCode,
      },
    };
  });
  await nextTick();
  fitView({ padding: 0.2 });
}

function exportAll() {
  // Build flowConfig from raw data
  const nodesOut = [];
  flowNodes.value.forEach((fn) => {
    const raw = rawNodeMap.value.get(fn.id);
    if (raw) nodesOut.push(JSON.parse(JSON.stringify(raw)));
  });
  const edgesOut = JSON.parse(JSON.stringify(rawEdgeList.value));

  const flowConfig = { nodes: nodesOut, edges: edgesOut };
  const flowLayout = {
    exportedAt: new Date().toISOString(),
    positions: flowNodes.value
      .filter((n) => !n.id.startsWith("__group_"))
      .map((n) => ({
        name: n.id,
        x: n.position.x,
        y: n.position.y,
      })),
  };
  const payload = { flowConfig, flowLayout };
  const text = JSON.stringify(payload, null, 2);
  exportText.value = text;

  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "btu-flow-export.json";
  a.click();
  URL.revokeObjectURL(url);
}

function onConnect(connection) {
  addEdges([
    {
      ...connection,
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      type: "smoothstep",
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
function clearSelection() {
  selectedNodeId.value = "";
  selectedEdgeId.value = "";
}

function updateSelectedNode(patch) {
  if (!selectedNodeId.value) return;
  const oldId = selectedNodeId.value;
  if (typeof patch.name === "string") {
    const trimmed = patch.name.trim();
    if (trimmed && trimmed !== oldId) {
      const nextId = buildUniqueNodeId(trimmed, oldId);
      // Update raw map key
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
  // Sync patch to raw map
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

function buildUniqueNodeId(base, oldId) {
  const used = new Set(
    flowNodes.value.map((n) => n.id).filter((id) => id !== oldId)
  );
  if (!used.has(base)) return base;
  let idx = 2;
  while (used.has(`${base}_${idx}`)) idx += 1;
  return `${base}_${idx}`;
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

function onPaneReady() {
  fitView({ padding: 0.2 });
}
function fitCurrentView() {
  fitView({ padding: 0.2 });
}

function onPaletteDragStart(event, lineType) {
  event.dataTransfer?.setData(DRAG_NODE_MIME, lineType);
  event.dataTransfer.effectAllowed = "move";
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

async function onFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  jsonInput.value = text;
  await generateFromInput();
  event.target.value = "";
}
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.left-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
button,
.file-btn {
  border: 1px solid #6c7a8f;
  background: #f7fbff;
  color: #102333;
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
  font-size: 14px;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.file-btn input {
  display: none;
}
.tips {
  font-size: 13px;
  color: #4f6074;
}
.io-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.io-panel textarea {
  width: 100%;
  min-height: 150px;
  resize: vertical;
  border: 1px solid #bbcad8;
  border-radius: 10px;
  padding: 10px;
  background: #ffffffdb;
  font-size: 13px;
}
.editor-wrap {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 12px;
  min-height: 66vh;
}
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
  .io-panel {
    grid-template-columns: 1fr;
  }
  .editor-wrap {
    grid-template-columns: 1fr;
  }
  .btu-flow {
    height: 58vh;
  }
}
</style>
