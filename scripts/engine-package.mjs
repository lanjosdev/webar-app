import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'

export function getEnginePackageInfo(projectRoot) {
  const packagePath = resolve(
    projectRoot,
    'node_modules/@8thwall/engine-binary/package.json',
  )
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  const version = packageJson.version

  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(version)) {
    throw new Error(`Invalid @8thwall/engine-binary version in ${packagePath}`)
  }

  return {
    publicPath: `external/xr/v${version}`,
    version,
  }
}
