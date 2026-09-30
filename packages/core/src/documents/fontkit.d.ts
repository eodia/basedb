// fontkit ships no types: what `fonts.ts` asks of it, and nothing more.
declare module 'fontkit' {
  export function openSync(path: string, postscriptName?: string): unknown
}
