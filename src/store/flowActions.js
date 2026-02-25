import { nextTick } from "vue";
import {
    jsonInput,
    exportText,
    flowNodes,
    flowEdges,
    rawNodeMap,
    rawEdgeList,
} from "./flowStore.js";
import { safeParse, buildLayout, parseEdgeDays } from "../utils/layout.js";
import { useVueFlow } from "@vue-flow/core";

export async function generateFromInput() {
    try {
        const { nodeList, edgeList } = safeParse(jsonInput.value);
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

        // Fit view will be called via event or ref in the view
    } catch (error) {
        alert(`解析失败：${error.message}`);
    }
}

export async function sortLayout() {
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
                operationTypeCode: cur?.data?.operationTypeCode || n.data.operationTypeCode,
            },
        };
    });
    await nextTick();
}

export function exportAll() {
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
