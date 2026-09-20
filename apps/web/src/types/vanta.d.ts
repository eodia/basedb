/**
 * `three` and `vanta` ship no types we can use here.
 *
 * `three` has `@types/three`, but versioned against releases far newer than the r134 that
 * vanta needs; pinning a mismatched set would describe a library we do not run. Vanta
 * has none at all. What this code does with either is narrow — hand one to the other and
 * keep a handle to destroy — so the honest declaration is the loose one, with the shape
 * we actually rely on written out in `clouds.tsx`.
 */
declare module 'three' {
  const three: unknown
  export default three
}

declare module 'vanta/dist/vanta.clouds.min.js' {
  const create: (options: Record<string, unknown>) => { destroy(): void }
  export default create
}
