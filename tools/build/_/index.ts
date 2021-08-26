import * as chokidar from "chokidar"
import * as fs from "fs/promises"
import {
  EMPTY,
  Observable,
  from,
  fromEvent,
  identity,
  defer,
  of
} from "rxjs"
import {
  catchError,
  mapTo,
  mergeWith,
  switchMap,
  tap
} from "rxjs/operators"
import glob from "tiny-glob"

/* ----------------------------------------------------------------------------
 * Helper types
 * ------------------------------------------------------------------------- */

/**
 * Resolve options
 */
interface ResolveOptions {
  cwd: string                          /* Working directory */
  watch?: boolean                      /* Watch mode */
}

/**
 * Watch options
 */
interface WatchOptions {
  cwd: string                          /* Working directory */
}

/* ----------------------------------------------------------------------------
 * Data
 * ------------------------------------------------------------------------- */

/**
 * Base directory for compiled files
 */
export const base = "bes_theme"

/**
 * Cache to omit redundant writes
 */
export const cache = new Map<string, string>()

/* ----------------------------------------------------------------------------
 * Helper Ffunctions
 * ------------------------------------------------------------------------- */

/**
 * Return the current time
 *
 * @returns Time
 */
function now() {
  const date = new Date()
  return [
    `${date.getHours()}`.padStart(2, "0"),
    `${date.getMinutes()}`.padStart(2, "0"),
    `${date.getSeconds()}`.padStart(2, "0")
  ]
    .join(":")
}

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Resolve a pattern
 *
 * @param pattern - Pattern
 * @param options - Options
 *
 * @returns File observable
 */
export function resolve(
  pattern: string, options?: ResolveOptions
): Observable<string> {
  return from(glob(pattern, options))
    .pipe(
      catchError(() => EMPTY),
      switchMap(files => from(files)),
      options?.watch
        ? mergeWith(watch(pattern, options))
        : identity
    )
}

/**
 * Watch all files matching the given pattern
 *
 * @param pattern - Pattern
 * @param options - Options
 *
 * @returns File observable
 */
export function watch(
  pattern: string, options: WatchOptions
): Observable<string> {
  return fromEvent(
    chokidar.watch(pattern, options),
    "change"
  ) as Observable<string>
}

/* ------------------------------------------------------------------------- */

/**
 * Recursively create the given directory
 *
 * @param directory - Directory
 *
 * @returns Directory observable
 */
export function mkdir(directory: string): Observable<string> {
  return defer(() => fs.mkdir(directory, { recursive: true }))
    .pipe(
      mapTo(directory)
    )
}

/**
 * Read a file
 *
 * @param file - File
 *
 * @returns File data observable
 */
export function read(file: string): Observable<string> {
  return defer(() => fs.readFile(file, "utf8"))
}


/**
 * Write a file, but only if the contents changed
 *
 * @param file - File
 * @param data - File data
 *
 * @returns File observable
 */
export function write(file: string, data: string): Observable<string> {
  let contents = cache.get(file)
  if (contents === data) {
    return of(file)
  } else {
    cache.set(file, data)
    return defer(() => fs.writeFile(file, data))
      .pipe(
        mapTo(file),
        process.argv.includes("--verbose")
          ? tap(file => console.log(`${now()} + ${file}`))
          : identity
      )
  }
}
