export interface ComponentData {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fills?: any[];
}

export interface ColorData {
  name: string;
  color: {
    r: number;
    g: number;
    b: number;
  };
  opacity: number;
}

export interface TypographyData {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

export interface ImageAnalysisResult {
  components: ComponentData[];
  colors: ColorData[];
  typography: TypographyData[];
}
