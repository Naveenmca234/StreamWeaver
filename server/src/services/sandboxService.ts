import vm from 'node:vm';

let ivm: any = null;
let ivmAttempted = false;

const loadIsolatedVm = async () => {
  if (ivmAttempted) return ivm;
  ivmAttempted = true;
  try {
    // dynamic import; if native addon isn't present the import will fail
    // @ts-ignore
    ivm = await import('isolated-vm');
  } catch {
    ivm = null;
  }
  return ivm;
};

export interface SandboxResult {
  success: boolean;
  value?: unknown;
  error?: string;
}

const EXECUTION_TIMEOUT_MS = 100;
const MEMORY_LIMIT_MB = 32;

// Shared isolated context for fast compiled function evaluation
const sandboxBase = Object.create(null);
sandboxBase.Math = Math;
sandboxBase.String = String;
sandboxBase.Number = Number;
sandboxBase.Boolean = Boolean;
sandboxBase.Array = Array;
sandboxBase.Date = Date;
sandboxBase.RegExp = RegExp;
sandboxBase.JSON = JSON;
sandboxBase.parseInt = parseInt;
sandboxBase.parseFloat = parseFloat;
sandboxBase.isNaN = isNaN;
sandboxBase.isFinite = isFinite;

const sharedContext = vm.createContext(sandboxBase);
const fnCache = new Map<string, (value: unknown, row: unknown) => unknown>();

function getCompiledFunction(code: string): (value: unknown, row: unknown) => unknown {
  let fn = fnCache.get(code);
  if (!fn) {
    fn = vm.compileFunction(code, ['value', 'row'], {
      parsingContext: sharedContext
    }) as (value: unknown, row: unknown) => unknown;
    fnCache.set(code, fn);
  }
  return fn;
}

const FORBIDDEN_PATTERNS = [
  /process\s*(\.|\[)/,
  /require\s*\(/,
  /import\s*\(/,
  /child_process/,
  /fs\s*(\.|\[)/,
  /__proto__/,
  /constructor\s*(\.|\[)/,
  /global(This)?\s*(\.|\[)/,
  /\beval\s*\(/,
  /\bFunction\s*\(/,
  /\bReflect\b/,
  /\bProxy\b/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/
];

export async function runTransform(
  code: string,
  value: unknown,
  row: Record<string, unknown>
): Promise<SandboxResult> {
  if (!code || !code.trim()) {
    return { success: true, value };
  }

  // Pre-check code for dangerous access patterns
  const trimmedCode = code.trim();
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(trimmedCode)) {
      return { success: false, error: 'Security violation: Access to restricted host APIs is prohibited.' };
    }
  }

  const isolatedVm = await loadIsolatedVm();

  if (isolatedVm) {
    try {
      const isolate = new isolatedVm.Isolate({ memoryLimit: MEMORY_LIMIT_MB });
      const context = await isolate.createContext();
      const jail = context.global;
      await jail.set('global', jail.derefInto());
      await jail.set('value', new isolatedVm.ExternalCopy(value).copyInto());
      await jail.set('row', new isolatedVm.ExternalCopy(row).copyInto());

      const script = await isolate.compileScript(`(function() {\n${code}\n})()`);
      const result = await script.run(context, { timeout: EXECUTION_TIMEOUT_MS });
      const output = result instanceof isolatedVm.Reference ? await result.copy() : result;
      return { success: true, value: output };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // High-throughput compiled function evaluation inside shared isolated context
  try {
    const fn = getCompiledFunction(code);
    const output = fn(value, row);
    return { success: true, value: output };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
