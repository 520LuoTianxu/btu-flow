import { ref, computed } from "vue";

export const jsonInput = ref("");
export const exportText = ref("");
export const flowNodes = ref([]);
export const flowEdges = ref([]);
export const nodeSeq = ref(1);

export const selectedNodeId = ref("");
export const selectedEdgeId = ref("");

export const rawNodeMap = ref(new Map());
export const rawEdgeList = ref([]);

export const drawerVisible = ref(false);
export const drawerNodeData = ref(null);

export const selectedNode = computed(() =>
    flowNodes.value.find((n) => n.id === selectedNodeId.value)
);
export const selectedEdge = computed(() =>
    flowEdges.value.find((e) => e.id === selectedEdgeId.value)
);

export function clearSelection() {
    selectedNodeId.value = "";
    selectedEdgeId.value = "";
}

export function buildUniqueNodeId(base, oldId) {
    const used = new Set(
        flowNodes.value.map((n) => n.id).filter((id) => id !== oldId)
    );
    if (!used.has(base)) return base;
    let idx = 2;
    while (used.has(`${base}_${idx}`)) idx += 1;
    return `${base}_${idx}`;
}

export const DRAG_NODE_MIME = "application/x-btu-node";
