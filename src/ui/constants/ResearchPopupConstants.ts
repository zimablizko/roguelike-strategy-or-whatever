export const RESEARCH_POPUP_LAYOUT = {
  width: 980,
  height: 620,
  padding: 14,
  headerHeight: 44,
  statusOffsetY: 0,
  tabOffsetY: 92,
  treeOffsetY: 138,
  treeDrawTop: 8,
  treeDrawBottom: 8,
  treeScrollStep: 96,
  treeControlColumnWidth: 44,
  nodeWidth: 280,
  nodeHeight: 78,
  nodeButtonZoneWidth: 86,
  nodeVerticalGap: 56,
  nodeHorizontalGap: 40,
} as const;

export const RESEARCH_POPUP_DERIVED = {
  contentWidth:
    RESEARCH_POPUP_LAYOUT.width - RESEARCH_POPUP_LAYOUT.padding * 2,
  contentHeight:
    RESEARCH_POPUP_LAYOUT.height -
    RESEARCH_POPUP_LAYOUT.headerHeight -
    RESEARCH_POPUP_LAYOUT.padding * 2,
} as const;

export const RESEARCH_TREE_DERIVED = {
  viewportWidth: RESEARCH_POPUP_DERIVED.contentWidth,
  viewportHeight:
    RESEARCH_POPUP_DERIVED.contentHeight -
    RESEARCH_POPUP_LAYOUT.treeOffsetY -
    6,
} as const;

export const RESEARCH_TREE_DRAW = {
  height:
    RESEARCH_TREE_DERIVED.viewportHeight -
    RESEARCH_POPUP_LAYOUT.treeDrawTop -
    RESEARCH_POPUP_LAYOUT.treeDrawBottom,
} as const;
