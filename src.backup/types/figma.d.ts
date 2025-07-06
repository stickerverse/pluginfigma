/**
 * Type definitions for Figma Plugin API
 * These are simplified versions of the official types
 */

declare const figma: PluginAPI;
declare const __html__: string;

interface PluginAPI {
  readonly apiVersion: string;
  readonly command: string;
  readonly viewport: ViewportAPI;
  readonly root: DocumentNode;
  readonly currentPage: PageNode;
  readonly hasMissingFont: boolean;
  readonly ui: UIAPI;
  skipInvisibleInstanceChildren: boolean;
  closePlugin(message?: string): void;
  notify(message: string, options?: NotificationOptions): NotificationHandler;
  showUI(html: string, options?: ShowUIOptions): void;
  createRectangle(): RectangleNode;
  createLine(): LineNode;
  createEllipse(): EllipseNode;
  createPolygon(): PolygonNode;
  createStar(): StarNode;
  createText(): TextNode;
  createFrame(): FrameNode;
  createComponent(): ComponentNode;
  createPage(): PageNode;
  createSlice(): SliceNode;
  createImage(data: Uint8Array): Image;
  group(nodes: ReadonlyArray<BaseNode>, parent: BaseNode & ChildrenMixin, index?: number): FrameNode;
  flatten(nodes: ReadonlyArray<BaseNode>, parent?: BaseNode & ChildrenMixin, index?: number): VectorNode;
  union(nodes: ReadonlyArray<BaseNode>, parent: BaseNode & ChildrenMixin, index?: number): BooleanOperationNode;
  createPaintStyle(): PaintStyle;
  createTextStyle(): TextStyle;
  createEffectStyle(): EffectStyle;
  createGridStyle(): GridStyle;
}

interface ViewportAPI {
  center: { x: number, y: number };
  zoom: number;
  scrollAndZoomIntoView(nodes: ReadonlyArray<BaseNode>): void;
}

interface UIAPI {
  show(): void;
  hide(): void;
  resize(width: number, height: number): void;
  close(): void;
  postMessage(pluginMessage: any): void;
  onmessage: ((pluginMessage: any) => void) | undefined;
  on(type: 'message', callback: (pluginMessage: any) => void): void;
  once(type: 'message', callback: (pluginMessage: any) => void): void;
}

interface NotificationOptions {
  timeout?: number;
  error?: boolean;
}

interface NotificationHandler {
  cancel: () => void;
}

interface ShowUIOptions {
  visible?: boolean;
  width?: number;
  height?: number;
  position?: { x: number, y: number };
  title?: string;
  themeColors?: boolean;
}

// Base Node Types
interface BaseNode {
  id: string;
  name: string;
  readonly type: NodeType;
  readonly parent: (BaseNode & ChildrenMixin) | null;
  readonly removed: boolean;
  setPluginData(key: string, value: string): void;
  getPluginData(key: string): string;
}

interface SceneNode extends BaseNode {
  readonly visible: boolean;
  locked: boolean;
}

interface ChildrenMixin {
  readonly children: ReadonlyArray<SceneNode>;
  appendChild(child: SceneNode): void;
  insertChild(index: number, child: SceneNode): void;
  findAll(callback?: (node: SceneNode) => boolean): SceneNode[];
  findOne(callback: (node: SceneNode) => boolean): SceneNode | null;
}

interface LayoutMixin {
  readonly absoluteTransform: Transform;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

interface BlendMixin {
  opacity: number;
  blendMode: BlendMode;
  isMask: boolean;
  effects: ReadonlyArray<Effect>;
  effectStyleId: string;
}

// Node Types
interface DocumentNode extends BaseNode, ChildrenMixin {
  readonly type: "DOCUMENT";
}

interface PageNode extends BaseNode, ChildrenMixin, LayoutMixin {
  readonly type: "PAGE";
  backgrounds: ReadonlyArray<Paint>;
}

interface FrameNode extends SceneNode, ChildrenMixin, LayoutMixin, BlendMixin {
  readonly type: "FRAME";
  layoutMode: "NONE" | "HORIZONTAL" | "VERTICAL";
  fills: ReadonlyArray<Paint>;
  strokes: ReadonlyArray<Paint>;
}

interface ComponentNode extends SceneNode, ChildrenMixin, LayoutMixin, BlendMixin {
  readonly type: "COMPONENT";
  fills: ReadonlyArray<Paint>;
  strokes: ReadonlyArray<Paint>;
}

interface VectorNode extends SceneNode, LayoutMixin, BlendMixin {
  readonly type: "VECTOR";
  fills: ReadonlyArray<Paint>;
  strokes: ReadonlyArray<Paint>;
}

interface RectangleNode extends SceneNode, LayoutMixin, BlendMixin {
  readonly type: "RECTANGLE";
  fills: ReadonlyArray<Paint>;
  strokes: ReadonlyArray<Paint>;
  cornerRadius: number;
}

interface LineNode extends SceneNode, LayoutMixin, BlendMixin {
  readonly type: "LINE";
  strokes: ReadonlyArray<Paint>;
}

interface EllipseNode extends SceneNode, LayoutMixin, BlendMixin {
  readonly type: "ELLIPSE";
  fills: ReadonlyArray<Paint>;
  strokes: ReadonlyArray<Paint>;
}

interface PolygonNode extends SceneNode, LayoutMixin, BlendMixin {
  readonly type: "POLYGON";
  fills: ReadonlyArray<Paint>;
  strokes: ReadonlyArray<Paint>;
  pointCount: number;
}

interface StarNode extends SceneNode, LayoutMixin, BlendMixin {
  readonly type: "STAR";
  fills: ReadonlyArray<Paint>;
  strokes: ReadonlyArray<Paint>;
  pointCount: number;
  innerRadius: number;
}

interface TextNode extends SceneNode, LayoutMixin, BlendMixin {
  readonly type: "TEXT";
  fills: ReadonlyArray<Paint>;
  strokes: ReadonlyArray<Paint>;
  characters: string;
  fontSize: number;
  fontName: FontName;
  textAlignHorizontal: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  textAlignVertical: "TOP" | "CENTER" | "BOTTOM";
  lineHeight: number;
  letterSpacing: number;
}

interface SliceNode extends SceneNode, LayoutMixin {
  readonly type: "SLICE";
}

interface BooleanOperationNode extends SceneNode, ChildrenMixin, LayoutMixin, BlendMixin {
  readonly type: "BOOLEAN_OPERATION";
  fills: ReadonlyArray<Paint>;
  strokes: ReadonlyArray<Paint>;
  booleanOperation: "UNION" | "INTERSECT" | "SUBTRACT" | "EXCLUDE";
}

// Styles & Effects
interface PaintStyle extends BaseStyle {
  readonly type: "PAINT";
  paints: ReadonlyArray<Paint>;
}

interface TextStyle extends BaseStyle {
  readonly type: "TEXT";
  fontSize: number;
  fontName: FontName;
  letterSpacing: number;
  lineHeight: number;
  paragraphIndent: number;
  paragraphSpacing: number;
  textCase: TextCase;
  textDecoration: TextDecoration;
}

interface EffectStyle extends BaseStyle {
  readonly type: "EFFECT";
  effects: ReadonlyArray<Effect>;
}

interface GridStyle extends BaseStyle {
  readonly type: "GRID";
  layoutGrids: ReadonlyArray<LayoutGrid>;
}

interface BaseStyle {
  readonly id: string;
  readonly type: StyleType;
  name: string;
  description: string;
}

// Paint & Color Types
type Paint = SolidPaint | GradientPaint | ImagePaint;

interface SolidPaint {
  readonly type: "SOLID";
  color: RGB;
  opacity?: number;
  visible?: boolean;
}

interface GradientPaint {
  readonly type: "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "GRADIENT_ANGULAR" | "GRADIENT_DIAMOND";
  gradientStops: ReadonlyArray<ColorStop>;
  opacity?: number;
  visible?: boolean;
}

interface ImagePaint {
  readonly type: "IMAGE";
  scaleMode: "FILL" | "FIT" | "CROP" | "TILE";
  imageHash: string | null;
  opacity?: number;
  visible?: boolean;
}

interface ColorStop {
  position: number;
  color: RGBA;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

// Utility Types
interface Transform {
  readonly [0]: number;
  readonly [1]: number;
  readonly [2]: number;
  readonly [3]: number;
  readonly [4]: number;
  readonly [5]: number;
}

interface FontName {
  readonly family: string;
  readonly style: string;
}

interface Image {
  readonly hash: string;
}

// Effect Types
type Effect = DropShadowEffect | InnerShadowEffect | BlurEffect;

interface DropShadowEffect {
  readonly type: "DROP_SHADOW";
  color: RGBA;
  offset: Vector;
  radius: number;
  visible: boolean;
  blendMode: BlendMode;
}

interface InnerShadowEffect {
  readonly type: "INNER_SHADOW";
  color: RGBA;
  offset: Vector;
  radius: number;
  visible: boolean;
  blendMode: BlendMode;
}

interface BlurEffect {
  readonly type: "LAYER_BLUR" | "BACKGROUND_BLUR";
  radius: number;
  visible: boolean;
}

// Grid Types
type LayoutGrid = RowsColsLayoutGrid | GridLayoutGrid;

interface RowsColsLayoutGrid {
  pattern: "ROWS" | "COLUMNS";
  alignment: "MIN" | "MAX" | "STRETCH" | "CENTER";
  gutterSize: number;
  count: number;
  sectionSize?: number;
  offset?: number;
  visible: boolean;
  color: RGBA;
}

interface GridLayoutGrid {
  pattern: "GRID";
  sectionSize: number;
  visible: boolean;
  color: RGBA;
}

// Enums
type NodeType = 
  | "DOCUMENT"
  | "PAGE"
  | "SLICE"
  | "FRAME"
  | "GROUP"
  | "COMPONENT"
  | "INSTANCE"
  | "BOOLEAN_OPERATION"
  | "VECTOR"
  | "STAR"
  | "LINE"
  | "ELLIPSE"
  | "POLYGON"
  | "RECTANGLE"
  | "TEXT";

type StyleType = "PAINT" | "TEXT" | "EFFECT" | "GRID";

type BlendMode =
  | "PASS_THROUGH"
  | "NORMAL"
  | "DARKEN"
  | "MULTIPLY"
  | "LINEAR_BURN"
  | "COLOR_BURN"
  | "LIGHTEN"
  | "SCREEN"
  | "LINEAR_DODGE"
  | "COLOR_DODGE"
  | "OVERLAY"
  | "SOFT_LIGHT"
  | "HARD_LIGHT"
  | "DIFFERENCE"
  | "EXCLUSION"
  | "HUE"
  | "SATURATION"
  | "COLOR"
  | "LUMINOSITY";

type TextCase = "ORIGINAL" | "UPPER" | "LOWER" | "TITLE";

type TextDecoration = "NONE" | "UNDERLINE" | "STRIKETHROUGH";

interface Vector {
  x: number;
  y: number;
}
