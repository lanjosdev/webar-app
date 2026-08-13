import {cpSync, existsSync, mkdirSync, rmSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

import {getEnginePackageInfo} from './engine-package.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(projectRoot, 'node_modules/@8thwall/engine-binary/dist')
const enginePublicRoot = resolve(projectRoot, 'public/external/xr')
const {publicPath, version} = getEnginePackageInfo(projectRoot)
const destination = resolve(projectRoot, 'public', publicPath)

if (!existsSync(source)) {
  throw new Error(
    '8th Wall Engine artifacts were not found. Run npm install before copying the Engine.',
  )
}

rmSync(enginePublicRoot, {force: true, recursive: true})
mkdirSync(dirname(destination), {recursive: true})
cpSync(source, destination, {recursive: true})

console.log(`8th Wall Engine ${version} copied to public/${publicPath}`)
