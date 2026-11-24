/* tslint:disable */
/* eslint-disable */

export function get_all_items_json(): string;

export function get_total_count(): number;

export function init_engine_from_bincode(bytes: Uint8Array | number[]): number;

export function init_engine_from_brotli(compressed_bytes: Uint8Array | number[]): number;

export function search_articles_json(query: string, smart_mode?: boolean | null): string;

export function search_json(query: string, limit: number, smart_mode?: boolean | null): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly get_all_items_json: () => [number, number];
    readonly get_total_count: () => number;
    readonly init_engine_from_bincode: (a: number, b: number) => [number, number, number];
    readonly init_engine_from_brotli: (a: number, b: number) => [number, number, number];
    readonly search_articles_json: (a: number, b: number, c: number) => [number, number];
    readonly search_json: (a: number, b: number, c: number, d: number) => [number, number];
    readonly BrotliDecoderCreateInstance: (a: number, b: number, c: number) => number;
    readonly BrotliDecoderDecompress: (a: number, b: number, c: number, d: number) => number;
    readonly BrotliDecoderDecompressPrealloc: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
    readonly BrotliDecoderDecompressStream: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly BrotliDecoderDecompressStreaming: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly BrotliDecoderDecompressWithReturnInfo: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly BrotliDecoderDestroyInstance: (a: number) => void;
    readonly BrotliDecoderErrorString: (a: number) => number;
    readonly BrotliDecoderFreeU8: (a: number, b: number, c: number) => void;
    readonly BrotliDecoderFreeUsize: (a: number, b: number, c: number) => void;
    readonly BrotliDecoderGetErrorCode: (a: number) => number;
    readonly BrotliDecoderGetErrorString: (a: number) => number;
    readonly BrotliDecoderHasMoreOutput: (a: number) => number;
    readonly BrotliDecoderIsFinished: (a: number) => number;
    readonly BrotliDecoderIsUsed: (a: number) => number;
    readonly BrotliDecoderMallocU8: (a: number, b: number) => number;
    readonly BrotliDecoderMallocUsize: (a: number, b: number) => number;
    readonly BrotliDecoderSetParameter: (a: number, b: number, c: number) => void;
    readonly BrotliDecoderTakeOutput: (a: number, b: number) => number;
    readonly BrotliDecoderVersion: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
