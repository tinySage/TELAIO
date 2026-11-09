/**
 * Parameter expressions for parametric design. Every dimension in a sketch or feature is an expression
 * that may reference named parameters, so changing one parameter regenerates everything that uses it.
 *
 * Grammar: numbers, parameter names, + − × ÷ ^, unary minus, parentheses, the constant pi, and the
 * functions sqrt abs min max sin cos tan (degrees). Anything else is an error, never a silent zero.
 */

export type Parameter = { name: string; expr: string; note?: string }

type Token = { kind: 'num'; value: number } | { kind: 'id'; value: string } | { kind: 'op'; value: string }

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (/\s/.test(c)) { i++; continue }
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(text.slice(i))
    if (num) { tokens.push({ kind: 'num', value: Number(num[0]) }); i += num[0].length; continue }
    const id = /^[A-Za-z_]\w*/.exec(text.slice(i))
    if (id) { tokens.push({ kind: 'id', value: id[0] }); i += id[0].length; continue }
    if ('+-*/^(),'.includes(c)) { tokens.push({ kind: 'op', value: c }); i++; continue }
    throw new Error(`Unexpected "${c}"`)
  }
  return tokens
}

const rad = (d: number) => d * Math.PI / 180
const FUNCTIONS: Record<string, { arity: [number, number]; fn: (...a: number[]) => number }> = {
  sqrt: { arity: [1, 1], fn: Math.sqrt }, abs: { arity: [1, 1], fn: Math.abs },
  min: { arity: [1, 16], fn: Math.min }, max: { arity: [1, 16], fn: Math.max },
  sin: { arity: [1, 1], fn: (d) => Math.sin(rad(d)) }, cos: { arity: [1, 1], fn: (d) => Math.cos(rad(d)) }, tan: { arity: [1, 1], fn: (d) => Math.tan(rad(d)) },
}

/** Evaluates an expression; `lookup` returns a parameter's value or throws. */
export function evaluate(text: string, lookup: (name: string) => number = (n) => { throw new Error(`Unknown parameter "${n}"`) }): number {
  if (!text.trim()) throw new Error('Empty expression')
  const tokens = tokenize(text)
  let pos = 0
  const peek = () => tokens[pos]
  const isOp = (v: string) => peek()?.kind === 'op' && peek()!.value === v
  const expect = (v: string) => { if (!isOp(v)) throw new Error(`Expected "${v}"`); pos++ }
  const expression = (): number => {
    let v = term()
    while (isOp('+') || isOp('-')) v = tokens[pos++].value === '+' ? v + term() : v - term()
    return v
  }
  const term = (): number => {
    let v = unary()
    while (isOp('*') || isOp('/')) v = tokens[pos++].value === '*' ? v * unary() : v / unary()
    return v
  }
  // Unary minus binds looser than ^, so -2^2 = -4 as in standard notation; ^ is right-associative.
  const unary = (): number => {
    if (isOp('-')) { pos++; return -unary() }
    if (isOp('+')) { pos++; return unary() }
    return power()
  }
  const power = (): number => {
    const base = primary()
    if (isOp('^')) { pos++; return base ** unary() }
    return base
  }
  const primary = (): number => {
    const t = peek()
    if (!t) throw new Error('Incomplete expression')
    if (t.kind === 'num') { pos++; return t.value }
    if (t.kind === 'op' && t.value === '(') { pos++; const v = expression(); expect(')'); return v }
    if (t.kind === 'id') {
      pos++
      const f = FUNCTIONS[t.value]
      if (f && isOp('(')) {
        pos++
        const args = [expression()]
        while (isOp(',')) { pos++; args.push(expression()) }
        expect(')')
        if (args.length < f.arity[0] || args.length > f.arity[1]) throw new Error(`${t.value} takes ${f.arity[0] === f.arity[1] ? f.arity[0] : f.arity[0] + '–' + f.arity[1]} argument(s)`)
        return f.fn(...args)
      }
      if (t.value === 'pi') return Math.PI
      return lookup(t.value)
    }
    throw new Error(`Unexpected "${t.value}"`)
  }
  const value = expression()
  if (pos < tokens.length) throw new Error(`Unexpected "${tokens[pos].value}"`)
  if (!Number.isFinite(value)) throw new Error('Result is not a finite number')
  return value
}

export const NAME_PATTERN = /^[A-Za-z_]\w*$/
const RESERVED = new Set(['pi', ...Object.keys(FUNCTIONS)])

/** Resolves every parameter, following references in any order; reports cycles and bad names per parameter. */
export function resolveParameters(params: Parameter[]): { values: Record<string, number>; errors: Record<string, string> } {
  const values: Record<string, number> = {}, errors: Record<string, string> = {}
  const byName = new Map<string, Parameter>()
  for (const p of params) {
    if (!NAME_PATTERN.test(p.name) || RESERVED.has(p.name)) errors[p.name] = 'Invalid or reserved name'
    else if (byName.has(p.name)) errors[p.name] = 'Duplicate name'
    else byName.set(p.name, p)
  }
  const visiting = new Set<string>()
  const resolve = (name: string): number => {
    if (name in values) return values[name]
    if (name in errors) throw new Error(`"${name}" has an error`)
    const p = byName.get(name)
    if (!p) throw new Error(`Unknown parameter "${name}"`)
    if (visiting.has(name)) throw new Error(`Circular reference through "${name}"`)
    visiting.add(name)
    try { values[name] = evaluate(p.expr, resolve); return values[name] } catch (e) { errors[name] = (e as Error).message; throw e } finally { visiting.delete(name) }
  }
  for (const name of byName.keys()) { try { resolve(name) } catch { /* recorded */ } }
  return { values, errors }
}
