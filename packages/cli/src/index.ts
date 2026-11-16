import { parseArgs, type ParseArgsOptionsConfig } from "node:util"
import { load, scan } from "@treeline/core"

export type ArgDef = {
    description?: string
    required?: boolean
    variadic?: boolean
}

export type FlagDef = {
    type?: "string" | "boolean"
    short?: string
    description?: string
    multiple?: boolean
    required?: boolean
    default?: string | boolean | string[] | boolean[]
}

export type ArgDefs = Record<string, ArgDef>
export type FlagDefs = Record<string, FlagDef>

type ArgValue<D extends ArgDef> = D["variadic"] extends true
    ? string[]
    : D["required"] extends true
      ? string
      : string | undefined

type FlagScalar<D extends FlagDef> = D["type"] extends "boolean"
    ? boolean
    : string

type FlagValue<D extends FlagDef> = D["multiple"] extends true
    ? FlagScalar<D>[]
    : D["required"] extends true
      ? FlagScalar<D>
      : D["type"] extends "boolean"
        ? boolean
        : D extends { default: unknown }
          ? FlagScalar<D>
          : FlagScalar<D> | undefined

export type Args<A extends ArgDefs> = { [K in keyof A]: ArgValue<A[K]> }
export type Flags<F extends FlagDefs> = { [K in keyof F]: FlagValue<F[K]> }

export type Context<A extends ArgDefs, F extends FlagDefs> = {
    args: Args<A>
    flags: Flags<F>
    path: string[]
}

export type Command<
    A extends ArgDefs = ArgDefs,
    F extends FlagDefs = FlagDefs,
> = {
    description?: string
    args?: A
    flags?: F
    run: (context: Context<A, F>) => unknown
}

export type CliOptions = {
    name: string
    dir: string | URL
    argv?: string[]
}

type Node = {
    file?: string
    children: Map<string, Node>
}

export const createCommand = <
    const A extends ArgDefs = {},
    const F extends FlagDefs = {},
>(
    command: Command<A, F>,
) => command

const usageError = (message: string) =>
    Object.assign(new Error(message), { code: "ERR_USAGE" })

const buildTree = async (dir: string | URL) => {
    const root: Node = { children: new Map() }
    for (const { segments, file } of await scan(dir)) {
        let node = root
        for (const segment of segments) {
            let child = node.children.get(segment)
            if (!child)
                node.children.set(segment, (child = { children: new Map() }))
            node = child
        }
        node.file = file
    }
    return root
}

const loadCommand = async (file: string) =>
    (await load(file)).default as Command

const pad = (rows: [string, string][]) => {
    const width = Math.max(...rows.map(([left]) => left.length))
    return rows.map(([left, right]) =>
        `  ${left.padEnd(width)}  ${right}`.trimEnd(),
    )
}

const argLabel = (name: string, def: ArgDef) => {
    const label = def.variadic ? `${name}...` : name
    return def.required ? `<${label}>` : `[${label}]`
}

const flagLabel = (name: string, def: FlagDef) =>
    `${def.short ? `-${def.short}, ` : "    "}--${name}${def.type === "boolean" ? "" : " <value>"}`

const help = async (
    name: string,
    path: string[],
    node: Node,
    command?: Command,
) => {
    const lines: string[] = []
    const args = Object.entries(command?.args ?? {})
    const flags = Object.entries(command?.flags ?? {})
    const usage = [name, ...path]
    if (node.children.size) usage.push("<command>")
    usage.push(...args.map(([key, def]) => argLabel(key, def)))
    if (flags.length) usage.push("[options]")
    if (command?.description) lines.push(command.description, "")
    lines.push(`Usage: ${usage.join(" ")}`)
    if (node.children.size) {
        const rows: [string, string][] = []
        for (const [key, child] of [...node.children].toSorted(([a], [b]) =>
            a.localeCompare(b),
        )) {
            const description = child.file
                ? (await loadCommand(child.file)).description
                : undefined
            rows.push([key, description ?? ""])
        }
        lines.push("", "Commands:", ...pad(rows))
    }
    if (args.length) {
        lines.push(
            "",
            "Arguments:",
            ...pad(args.map(([key, def]) => [key, def.description ?? ""])),
        )
    }
    const options: [string, string][] = flags.map(([key, def]) => [
        flagLabel(key, def),
        def.description ?? "",
    ])
    options.push(["-h, --help", "Show help"])
    lines.push("", "Options:", ...pad(options))
    return lines.join("\n")
}

const parse = (command: Command, argv: string[]) => {
    const flagDefs = command.flags ?? {}
    const options: ParseArgsOptionsConfig = Object.fromEntries(
        Object.entries(flagDefs).map(
            ([key, { type = "string", short, multiple, default: value }]) => [
                key,
                {
                    type,
                    ...(short && { short }),
                    multiple: !!multiple,
                    ...(value !== undefined && { default: value }),
                },
            ],
        ),
    )
    const { values, positionals } = parseArgs({
        args: argv,
        options,
        allowPositionals: true,
        strict: true,
    })
    const flags: Record<string, unknown> = {}
    for (const [key, def] of Object.entries(flagDefs)) {
        const value =
            values[key] ??
            (def.multiple ? [] : def.type === "boolean" ? false : undefined)
        if (
            def.required &&
            (value === undefined || (Array.isArray(value) && !value.length))
        ) {
            throw usageError(`Missing required option --${key}`)
        }
        flags[key] = value
    }
    const args: Record<string, unknown> = {}
    const entries = Object.entries(command.args ?? {})
    for (const [index, [key, def]] of entries.entries()) {
        const value = def.variadic ? positionals.splice(0) : positionals.shift()
        if (
            def.required &&
            (value === undefined || (Array.isArray(value) && !value.length))
        ) {
            throw usageError(`Missing required argument <${key}>`)
        }
        if (def.variadic && index !== entries.length - 1) {
            throw new Error(`Variadic argument <${key}> must be last`)
        }
        args[key] = value
    }
    if (positionals.length)
        throw usageError(`Unexpected argument ${positionals[0]}`)
    return { args, flags } as { args: ArgDefs; flags: FlagDefs }
}

export const runCli = async ({
    name,
    dir,
    argv = process.argv.slice(2),
}: CliOptions) => {
    let node = await buildTree(dir)
    const path: string[] = []
    let index = 0
    for (let child; (child = node.children.get(argv[index] ?? "")); index++) {
        path.push(argv[index]!)
        node = child
    }
    const rest = argv.slice(index)
    const command = node.file ? await loadCommand(node.file) : undefined
    const wantsHelp = rest.includes("--help") || rest.includes("-h")
    if (!command || wantsHelp) {
        const unknown =
            !wantsHelp && rest[0] && !rest[0].startsWith("-")
                ? rest[0]
                : undefined
        if (unknown) {
            console.error(
                `Unknown command: ${[name, ...path, unknown].join(" ")}\n`,
            )
            process.exitCode = 1
        }
        ;(unknown ? console.error : console.log)(
            await help(name, path, node, command),
        )
        return
    }
    let parsed
    try {
        parsed = parse(command, rest)
    } catch (error) {
        const code = (error as { code?: string }).code
        if (code !== "ERR_USAGE" && !code?.startsWith("ERR_PARSE_ARGS"))
            throw error
        console.error(
            `${(error as Error).message}\n\n${await help(name, path, node, command)}`,
        )
        process.exitCode = 1
        return
    }
    await command.run({ ...parsed, path } as Context<ArgDefs, FlagDefs>)
}
