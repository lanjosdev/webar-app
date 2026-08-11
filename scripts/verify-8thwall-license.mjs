import {existsSync, readFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const engineDirectory = resolve(projectRoot, 'dist/external/xr')
const engineScriptPath = resolve(engineDirectory, 'xr.js')
const licensePath = resolve(engineDirectory, 'LICENSE')

const requiredFiles = [engineScriptPath, licensePath]
const missingFiles = requiredFiles.filter((filePath) => !existsSync(filePath))

if (missingFiles.length > 0) {
  throw new Error(
    `Required 8th Wall legal files are missing from the production build:\n${missingFiles.join('\n')}`,
  )
}

const engineScript = readFileSync(engineScriptPath, 'utf8')
const license = readFileSync(licensePath, 'utf8')
const requiredEngineNotices = [
  'This product includes the XR Engine software developed by Niantic Spatial, Inc.',
  'Copyright © 2026 Niantic Spatial, Inc. All rights reserved.',
  'XR ENGINE LICENSE AGREEMENT',
  'NIANTIC SPATIAL HEREBY DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED',
]
const requiredLicenseNotices = [
  'Copyright © 2026 Niantic Spatial, Inc. All rights reserved.',
  'XR ENGINE LICENSE AGREEMENT',
  'NIANTIC SPATIAL HEREBY DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED',
]

verifyNotices(engineScriptPath, engineScript, requiredEngineNotices)
verifyNotices(licensePath, license, requiredLicenseNotices)

console.log('8th Wall Engine copyright, license, and warranty notices verified')

function verifyNotices(filePath, contents, requiredNotices) {
  const missingNotices = requiredNotices.filter((notice) => !contents.includes(notice))

  if (missingNotices.length === 0) {
    return
  }

  throw new Error(
    `Required 8th Wall legal notices are missing from ${filePath}:\n${missingNotices.join('\n')}`,
  )
}
