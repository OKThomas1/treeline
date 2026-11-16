import { readdir } from "node:fs/promises"
import { extname, join, relative, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

export type RouteFile = {
    segments: string[]
    file: string
}

const extensions = new Set([".ts", ".mts", ".js", ".mjs"])

const isRouteFile = (name: string) =>
    extensions.has(extname(name)) &&
    !name.slice(0, -extname(name).length).endsWith(".d") &&
    !name.startsWith("_")

const toPath = (dir: string | URL) =>
    dir instanceof URL || dir.startsWith("file:") ? fileURLToPath(dir) : dir

export const scan = async (dir: string | URL) => {
    const root = toPath(dir)
    const entries = await readdir(root, {
        recursive: true,
        withFileTypes: true,
    })
    return entries
        .filter(
            (entry) =>
                entry.isFile() &&
                isRouteFile(entry.name) &&
                !relative(root, entry.parentPath)
                    .split(sep)
                    .some((part) => part.startsWith("_")),
        )
        .map((entry) => {
            const file = join(entry.parentPath, entry.name)
            const parts = relative(root, file).split(sep)
            parts.push(parts.pop()!.slice(0, -extname(entry.name).length))
            if (parts.at(-1) === "index") parts.pop()
            return { segments: parts, file }
        })
        .toSorted((a, b) => a.file.localeCompare(b.file))
}

export const load = async (file: string): Promise<Record<string, unknown>> =>
    await import(pathToFileURL(file).href)
