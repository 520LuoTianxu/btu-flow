import { MarkerType } from "@vue-flow/core";
import dagre from "@dagrejs/dagre";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 88;

export function parseEdgeDays(edgeRaw) {
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

export function nodeStyle(lineType) {
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

export function edgeStyle(lineType) {
    return {
        stroke: "#38557a",
        strokeWidth: 2,
        strokeDasharray: lineType === "dynamic" ? "8 5" : "0",
    };
}

export function safeParse(inputText) {
    const parsed = JSON.parse(inputText);
    const flowConfig = parsed?.flowConfig ?? parsed;
    const nodeList = Array.isArray(flowConfig?.nodes) ? flowConfig.nodes : [];
    const edgeList = Array.isArray(flowConfig?.edges) ? flowConfig.edges : [];
    if (nodeList.length === 0) throw new Error("nodes 为空，无法生成布局");
    return { nodeList, edgeList };
}

export function buildLayout(nodeList, edgeList) {
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
    const groupInternalPositions = new Map();
    const groupSizes = new Map();
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

    // === 6. Edges ===
    const posMap = absolutePositions;

    const gapEdgeCount = new Map();
    const gapEdgeIndex = new Map();

    // Calculate gap spaces for all edges first to assign offsets
    normalEdges.forEach((e) => {
        const srcPos = posMap.get(e.source);
        const tgtPos = posMap.get(e.target);
        if (!srcPos || !tgtPos) return;

        const gS = nodeToGroup.get(e.source);
        const gT = nodeToGroup.get(e.target);
        const isSameGroup = (gS === gT);

        let gapKey = "";
        if (isSameGroup) {
            const leftX = Math.min(srcPos.x, tgtPos.x);
            const rightX = Math.max(srcPos.x, tgtPos.x);
            gapKey = `H:${gS}:${leftX}:${rightX}`;
        } else {
            const topY = Math.min(groupPositions.get(gS)?.y || 0, groupPositions.get(gT)?.y || 0);
            const bottomY = Math.max(groupPositions.get(gS)?.y || 0, groupPositions.get(gT)?.y || 0);
            gapKey = `V:${topY}:${bottomY}`;
        }

        gapEdgeCount.set(gapKey, (gapEdgeCount.get(gapKey) || 0) + 1);
        gapEdgeIndex.set(e.id, gapEdgeCount.get(gapKey) - 1);
    });

    const edges = normalEdges.map((e) => {
        const isDynamic = e.lineType === "dynamic";
        const srcPos = posMap.get(e.source);
        const tgtPos = posMap.get(e.target);

        let sourceHandle = "bottom-handle";
        let targetHandle = "top-handle";
        let customCenterY = undefined;
        let customCenterX = undefined;

        if (srcPos && tgtPos) {
            const gS = nodeToGroup.get(e.source);
            const gT = nodeToGroup.get(e.target);
            const isSameGroup = (gS === gT);

            let gapKey = "";
            if (isSameGroup) {
                const leftX = Math.min(srcPos.x, tgtPos.x);
                const rightX = Math.max(srcPos.x, tgtPos.x);
                gapKey = `H:${gS}:${leftX}:${rightX}`;
            } else {
                const topY = Math.min(groupPositions.get(gS)?.y || 0, groupPositions.get(gT)?.y || 0);
                const bottomY = Math.max(groupPositions.get(gS)?.y || 0, groupPositions.get(gT)?.y || 0);
                gapKey = `V:${topY}:${bottomY}`;
            }

            const count = gapEdgeCount.get(gapKey) || 1;
            const index = gapEdgeIndex.get(e.id) || 0;
            const offset = (index - (count - 1) / 2) * 24;

            if (isSameGroup) {
                sourceHandle = srcPos.x > tgtPos.x ? "left-handle" : "right-handle";
                targetHandle = srcPos.x > tgtPos.x ? "right-handle" : "left-handle";
                if (srcPos.x !== tgtPos.x) {
                    const srcEdgeX = srcPos.x > tgtPos.x ? srcPos.x : srcPos.x + NODE_WIDTH;
                    const tgtEdgeX = tgtPos.x > srcPos.x ? tgtPos.x : tgtPos.x + NODE_WIDTH;
                    customCenterX = (srcEdgeX + tgtEdgeX) / 2 + offset;
                } else if (srcPos.y !== tgtPos.y) {
                    // fallback if X matches perfectly, vertically separated nodes in same group (rare but possible)
                    customCenterX = srcPos.x + NODE_WIDTH + 40 + offset;
                }
            } else {
                sourceHandle = srcPos.y > tgtPos.y ? "top-handle" : "bottom-handle";
                targetHandle = srcPos.y > tgtPos.y ? "bottom-handle" : "top-handle";

                const gSBox = groupPositions.get(gS);
                const gSSize = groupSizes.get(gS);
                const gTBox = groupPositions.get(gT);
                const gTSize = groupSizes.get(gT);

                if (gSBox && gTBox && gSBox.y !== gTBox.y) {
                    if (gSBox.y < gTBox.y) {
                        const gapTop = gSBox.y + gSSize.height;
                        const gapBottom = gTBox.y;
                        customCenterY = (gapTop + gapBottom) / 2 + offset;
                    } else {
                        const gapTop = gTBox.y + gTSize.height;
                        const gapBottom = gSBox.y;
                        customCenterY = (gapTop + gapBottom) / 2 + offset;
                    }
                }
            }
        }

        return {
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle,
            targetHandle,
            type: "smart",
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
            data: { lineType: e.lineType, daysText: e.daysText, customCenterY },
        };
    });

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
