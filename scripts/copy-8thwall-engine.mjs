import {cpSync, existsSync, mkdirSync, rmSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(projectRoot, 'node_modules/@8thwall/engine-binary/dist')
const destination = resolve(projectRoot, 'public/external/xr')

if (!existsSync(source)) {
  throw new Error(
    '8th Wall Engine artifacts were not found. Run npm install before copying the Engine.',
  )
}

rmSync(destination, {force: true, recursive: true})
mkdirSync(dirname(destination), {recursive: true})
cpSync(source, destination, {recursive: true})

console.log('8th Wall Engine artifacts copied to public/external/xr')
