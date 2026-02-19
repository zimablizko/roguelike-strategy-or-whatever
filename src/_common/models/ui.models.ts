import type {
  Actor,
  Color,
  ImageSource,
  Keys,
  ScreenElement,
  Sprite,
  Text,
} from 'excalibur';
import type { BuildingManager } from '../../managers/BuildingManager';
import type { ResearchManager } from '../../managers/ResearchManager';
import type { ResourceManager } from '../../managers/ResourceManager';
import type { RulerManager } from '../../managers/RulerManager';
import type { StateManager } from '../../managers/StateManager';
import type { TurnManager } from '../../managers/TurnManager';
import type { ScreenPopup } from '../../ui/elements/ScreenPopup';
import type { TooltipProvider } from '../../ui/tooltip/TooltipProvider';
import type { MapView } from '../../ui/views/MapView';
import type {
  StateBuildingBuildStatus,
  StateBuildingMapOverlay,
} from './building-manager.models';
import type {
  StateBuildingId,
  TypedBuildingDefinition,
} from './buildings.models';
import type { MapData } from './map.models';
import type { TypedResearchDefinition } from './researches.models';
import type { ResourceType } from './resource.models';
import type { TooltipOutcome } from './tooltip.models';
import type { EndTurnIncomePulse } from './turn.models';

export interface InteractivePanelOptions {
  x: number;
  y: number;
  bgColor?: Color;
  hoverBgColor?: Color;
  pressedBgColor?: Color;
  hoverBorderColor?: Color;
  onClick?: () => void;
}

export interface ActionElementOptions extends InteractivePanelOptions {
  title: string;
  description: string;
  outcomes?: ActionOutcome[];
  tooltipProvider: TooltipProvider;
  width?: number;
  height?: number;
  icon?: ImageSource;
  iconSize?: number;
  textColor?: Color;
  tooltipBgColor?: Color;
  tooltipTextColor?: Color;
  tooltipWidth?: number;
}

export interface ActionOutcome extends TooltipOutcome {}

export interface ScreenButtonOptions {
  x: number;
  y: number;
  width?: number;
  height?: number;
  title?: string;
  idleBgColor?: Color;
  hoverBgColor?: Color;
  clickedBgColor?: Color;
  disabledBgColor?: Color;
  idleTextColor?: Color;
  hoverTextColor?: Color;
  clickedTextColor?: Color;
  disabledTextColor?: Color;
  onClick?: () => void;
}

export type ScreenListRenderItem<TItem> = (args: {
  ctx: CanvasRenderingContext2D;
  item: TItem;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}) => void;

export interface ScreenListOptions<TItem = unknown> {
  x: number;
  y: number;
  width: number;
  height: number;
  items: TItem[];
  itemHeight?: number;
  gap?: number;
  padding?: number;
  bgColor?: Color;
  textColor?: string;
  fontCss?: string;
  scrollStep?: number;
  transparent?: boolean;
  renderItem?: ScreenListRenderItem<TItem>;
  onItemActivate?: (item: TItem, index: number) => void;
  getItemLabel?: (item: TItem, index: number) => string;
  isItemDisabled?: (item: TItem, index: number) => boolean;
  isItemSelected?: (item: TItem, index: number) => boolean;
  showScrollbar?: boolean;
  scrollbarWidth?: number;
  scrollbarMinThumbHeight?: number;
  scrollbarTrackColor?: string;
  scrollbarThumbColor?: string;
  scrollbarThumbActiveColor?: string;
}

export interface ScreenListButtonItem {
  title: string;
  onClick: () => void;
  disabled?: boolean;
}

export type ScreenPopupAnchor = 'top-left' | 'top-right' | 'center';
export type ScreenPopupBackplateStyle = 'gray';

export type ScreenPopupContentBuilder = (
  contentRoot: ScreenElement,
  popup: ScreenPopup
) => void;

export interface ScreenPopupOptions {
  x: number;
  y: number;
  width?: number;
  height?: number;
  anchor?: ScreenPopupAnchor;
  title?: string;
  padding?: number;
  headerHeight?: number;
  bgColor?: Color;
  headerColor?: Color;
  textColor?: Color;
  z?: number;
  backplateStyle?: ScreenPopupBackplateStyle;
  backplateColor?: Color;
  closeOnBackplateClick?: boolean;
  content?: Actor | Actor[];
  contentBuilder?: ScreenPopupContentBuilder;
  onClose?: () => void;
}

export interface TurnDisplayOptions {
  x: number;
  y: number;
  turnManager: TurnManager;
  tooltipProvider?: TooltipProvider;
  textColor?: Color;
  panelBgColor?: Color;
  panelBorderColor?: Color;
  separatorColor?: Color;
  segmentColor?: Color;
  spentSegmentColor?: Color;
  barWidth?: number;
}

export interface StateDisplayOptions extends InteractivePanelOptions {
  stateManager: StateManager;
  textColor?: Color;
}

export interface RulerDisplayOptions extends InteractivePanelOptions {
  rulerManager: RulerManager;
  portraitSize?: number;
  textColor?: Color;
}

export interface ResourceDisplayOptions {
  x: number;
  y: number;
  resourceManager: ResourceManager;
  buildingManager: BuildingManager;
  tooltipProvider?: TooltipProvider;
  anchor?: 'top-left' | 'top-right';
  iconSize?: number;
  spacing?: number;
  bgColor?: Color;
  textColor?: Color;
}

export interface ResourceConfig {
  key: ResourceType;
  icon: ImageSource;
  label: string;
}

export interface QuickBuildViewOptions {
  buildingManager: BuildingManager;
  resourceManager: ResourceManager;
  turnManager: TurnManager;
  tooltipProvider: TooltipProvider;
  onSelectBuildingForPlacement?: (buildingId: StateBuildingId) => void;
  leftMargin?: number;
  bottomMargin?: number;
  width?: number;
  toggleButtonWidth?: number;
  toggleButtonHeight?: number;
}

export interface BuildRow {
  definition: TypedBuildingDefinition;
  status: StateBuildingBuildStatus;
  enabled: boolean;
}

export interface SelectedBuildingViewOptions {
  stateManager: StateManager;
  buildingManager: BuildingManager;
  resourceManager: ResourceManager;
  turnManager: TurnManager;
  tooltipProvider: TooltipProvider;
  width?: number;
  height?: number;
  bottomMargin?: number;
}

export interface MapIncomeEffectsViewOptions {
  mapView: MapView;
}

export interface IncomeVisualPulse extends EndTurnIncomePulse {
  ageMs: number;
  delayMs: number;
  durationMs: number;
  liftPx: number;
  jitterX: number;
  laneOffsetX: number;
  laneOffsetY: number;
  icon?: Sprite;
  amountText: Text;
  amountShadow: Text;
  amountTextWidth: number;
  amountTextHeight: number;
}

export interface MapBuildingOverlay extends StateBuildingMapOverlay {}

export interface MapBuildPlacementOverlay {
  buildingId: string;
  width: number;
  height: number;
  validTopLeftCells: ReadonlySet<number>;
}

export interface MapViewOptions {
  map: MapData;
  buildingsProvider?: () => ReadonlyArray<MapBuildingOverlay>;
  buildingsVersionProvider?: () => number;
  buildPlacementProvider?: () => MapBuildPlacementOverlay | undefined;
  buildPlacementVersionProvider?: () => number;
  onBuildPlacementConfirm?: (tileX: number, tileY: number) => void;
  onBuildPlacementCancel?: () => void;
  onBuildingSelected?: (instanceId: string | undefined) => void;
  shouldIgnoreLeftClick?: (screenX: number, screenY: number) => boolean;
  isInputBlocked?: () => boolean;
  tooltipProvider?: TooltipProvider;
  tileSize?: number;
  panSpeed?: number;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  showGrid?: boolean;
  initialPlayerStateCoverage?: number;
}

export interface ResearchStatusViewOptions extends InteractivePanelOptions {
  researchManager: ResearchManager;
  turnManager: TurnManager;
  width?: number;
  widthProvider?: () => number;
}

export interface StatePopupOptions {
  x: number;
  y: number;
  stateManager: StateManager;
  buildingManager: BuildingManager;
  resourceManager: ResourceManager;
  turnManager: TurnManager;
  tooltipProvider: TooltipProvider;
  anchor?: ScreenPopupAnchor;
  onClose?: () => void;
}

export interface BuildPopupOptions {
  x: number;
  y: number;
  buildingId: StateBuildingId;
  buildingManager: BuildingManager;
  resourceManager: ResourceManager;
  turnManager: TurnManager;
  anchor?: ScreenPopupAnchor;
  onBuilt?: (buildingId: StateBuildingId) => void;
  onClose?: () => void;
}

export interface ResearchPopupOptions {
  x: number;
  y: number;
  researchManager: ResearchManager;
  turnManager: TurnManager;
  tooltipProvider: TooltipProvider;
  anchor?: ScreenPopupAnchor;
  onClose?: () => void;
}

export interface TreeNodeLayout {
  definition: TypedResearchDefinition;
  depth: number;
  x: number;
  y: number;
}

export interface ForegroundPointerBlockOptions {
  pointerDown?: boolean;
  pointerUp?: boolean;
  pointerMove?: boolean;
  pointerEnter?: boolean;
  pointerWheel?: boolean;
  pointerCancel?: boolean;
  pointerDrag?: boolean;
}

export interface TooltipProviderOptions {
  z?: number;
}

export interface TooltipOutcomeRenderItem {
  iconSprite?: Sprite;
  textGraphic: Text;
  width: number;
}

export interface TooltipOutcomeRenderRow {
  labelGraphic?: Text;
  items: TooltipOutcomeRenderItem[];
  width: number;
  height: number;
}

export interface BuildingHotkeyConfig {
  key: Keys;
  label: string;
}
