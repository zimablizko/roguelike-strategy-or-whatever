export interface GameRuntimeIssue {
  source: 'console.error' | 'window.error' | 'unhandledrejection';
  message: string;
  stack?: string;
  timestamp: number;
}

export interface GameTestState {
  currentScene: string | null;
  sceneHistory: string[];
  issues: GameRuntimeIssue[];
}

export interface GameTestControls {
  startPreparationGame?: () => void;
}

interface GameTestWindow extends Window {
  __gameTestBridgeInstalled?: boolean;
  __gameTestControls?: GameTestControls;
  __gameTestState?: GameTestState;
}

interface GameTestBridge {
  reportScene: (sceneName: string) => void;
  setControl: <TControlName extends keyof GameTestControls>(
    controlName: TControlName,
    handler: GameTestControls[TControlName]
  ) => void;
}

declare global {
  interface Window {
    __gameTestBridgeInstalled?: boolean;
    __gameTestControls?: GameTestControls;
    __gameTestState?: GameTestState;
  }
}

const GAME_SCENE_ATTRIBUTE = 'data-game-scene';

function formatUnknown(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getOrCreateState(win: GameTestWindow): GameTestState {
  if (win.__gameTestState) {
    return win.__gameTestState;
  }

  const state: GameTestState = {
    currentScene: null,
    sceneHistory: [],
    issues: [],
  };
  win.__gameTestState = state;
  return state;
}

function getOrCreateControls(win: GameTestWindow): GameTestControls {
  if (win.__gameTestControls) {
    return win.__gameTestControls;
  }

  const controls: GameTestControls = {};
  win.__gameTestControls = controls;
  return controls;
}

function recordIssue(
  state: GameTestState,
  source: GameRuntimeIssue['source'],
  message: string,
  stack?: string
): void {
  state.issues.push({
    source,
    message,
    stack,
    timestamp: Date.now(),
  });
}

export function createGameTestBridge(
  win: GameTestWindow = window,
  doc: Document = document
): GameTestBridge {
  const state = getOrCreateState(win);
  const controls = getOrCreateControls(win);

  if (!win.__gameTestBridgeInstalled) {
    const originalConsoleError = console.error.bind(console);

    console.error = (...args: unknown[]) => {
      const firstErrorArg = args.find((arg) => arg instanceof Error);
      recordIssue(
        state,
        'console.error',
        args.map((arg) => formatUnknown(arg)).join(' '),
        firstErrorArg instanceof Error ? firstErrorArg.stack : undefined
      );
      originalConsoleError(...args);
    };

    win.addEventListener('error', (event) => {
      recordIssue(
        state,
        'window.error',
        event.message || formatUnknown(event.error),
        event.error instanceof Error ? event.error.stack : undefined
      );
    });

    win.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      recordIssue(
        state,
        'unhandledrejection',
        formatUnknown(reason),
        reason instanceof Error ? reason.stack : undefined
      );
    });

    win.__gameTestBridgeInstalled = true;
  }

  return {
    reportScene(sceneName: string) {
      state.currentScene = sceneName;
      state.sceneHistory.push(sceneName);
      doc.documentElement.setAttribute(GAME_SCENE_ATTRIBUTE, sceneName);
    },
    setControl(controlName, handler) {
      if (handler) {
        controls[controlName] = handler;
        return;
      }

      delete controls[controlName];
    },
  };
}
