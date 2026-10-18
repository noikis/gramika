declare module 'diff' {
  export function diffArrays<T>(
    before: T[],
    after: T[],
  ): {
    value: T[]
    added?: boolean
    removed?: boolean
  }[]
}
