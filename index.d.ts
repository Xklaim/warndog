export interface Warning {
  ruleId:      string;
  severity:    'low' | 'medium' | 'high' | 'critical';
  confidence:  number;
  line:        number;
  column?:     number;
  message:     string;
  suggestion?: string;
  code?:       { lines: string[]; startLine: number };
}

export interface FileResult {
  file:     string;
  filePath: string;
  warnings: Warning[];
}

export interface WarnDogConfig {
  include?:    string[];
  ignore?:     string[];
  severity?:   'low' | 'medium' | 'high' | 'critical';
  confidence?: number;
  debug?:      boolean;
  rules?:      Record<string, string | boolean | { severity: string; [key: string]: unknown }>;
  plugins?:    (string | Plugin)[];
  complexity?: {
    cyclomaticThreshold?: number;
    nestingThreshold?:    number;
    functionLengthMax?:   number;
  };
  output?: {
    format?: 'pretty' | 'json';
    color?:  boolean;
  };
}

export interface Rule {
  id:              string;
  description:     string;
  defaultSeverity: string;
  explanation?:    string;
  badExample?:     string;
  goodExample?:    string;
  type?:           'file' | 'cross-file';
  check?(ctx: RuleContext): Warning[] | Promise<Warning[]>;
  checkAll?(results: FileResult[], config: WarnDogConfig): Warning[] | Promise<Warning[]>;
}

export interface RuleContext {
  ast:         object;
  source:      string;
  sourceLines: string[];
  filePath:    string;
  config:      WarnDogConfig;
}

export interface Plugin {
  name:   string;
  rules?: Rule[];
  setup?: () => void | Promise<void>;
}

export declare class Engine {
  constructor(config?: WarnDogConfig);
  analyzeTarget(targetPath: string): Promise<FileResult[]>;
  analyzeFiles(files: string[]): Promise<FileResult[]>;
  analyzeFile(filePath: string): Promise<FileResult | null>;
}

export declare function loadConfig(explicitPath?: string, cwd?: string): Promise<WarnDogConfig>;
export declare function loadPlugins(plugins: (string | Plugin)[]): Promise<Plugin[]>;
export declare function createPlugin(def: Omit<Plugin, 'setup'> & { setup?: () => void }): Plugin;
export declare function createRule(def: Rule): Rule;
export declare function getAllRules(): Rule[];
