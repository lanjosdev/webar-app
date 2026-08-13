import {brotliCompressSync, constants, gzipSync} from 'node:zlib'
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs'
import {dirname, extname, relative, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

import {getEnginePackageInfo} from './engine-package.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = resolve(projectRoot, 'dist')
const vercelConfigPath = resolve(projectRoot, 'vercel.json')
const {publicPath: enginePublicPath, version: engineVersion} = getEnginePackageInfo(projectRoot)
const engineRoot = resolve(distRoot, enginePublicPath)
const placementModel = resolve(distRoot, 'models', 'Logo.glb')

const requiredFiles = [
  resolve(distRoot, 'index.html'),
  resolve(engineRoot, 'LICENSE'),
  resolve(engineRoot, 'xr.js'),
  resolve(engineRoot, 'xr-slam.js'),
  resolve(engineRoot, 'resources/media-worker.js'),
  placementModel,
]
const missingFiles = requiredFiles.filter((filePath) => !existsSync(filePath))

if (missingFiles.length > 0) {
  throw new Error(`Production build is missing required files:\n${missingFiles.join('\n')}`)
}

const placementModelBuffer = readFileSync(placementModel)
if (
  placementModelBuffer.length < 12 ||
  placementModelBuffer.toString('ascii', 0, 4) !== 'glTF' ||
  placementModelBuffer.readUInt32LE(4) !== 2 ||
  placementModelBuffer.readUInt32LE(8) !== placementModelBuffer.length
) {
  throw new Error('Production placement model is not a valid glTF 2.0 binary')
}

const files = listFiles(distRoot)
const sourceMaps = files.filter((filePath) => extname(filePath) === '.map')
if (sourceMaps.length > 0) {
  throw new Error(`Production source maps must not be public:\n${sourceMaps.join('\n')}`)
}

const indexPath = resolve(distRoot, 'index.html')
const indexHtml = readFileSync(indexPath, 'utf8')
const expectedEngineUrl = `/${enginePublicPath}/xr.js`

if (!indexHtml.includes(expectedEngineUrl)) {
  throw new Error(`index.html does not reference versioned Engine URL ${expectedEngineUrl}`)
}
if (indexHtml.includes('/src/') || indexHtml.includes('__8THWALL_ENGINE_PATH__')) {
  throw new Error('index.html still contains development or unresolved build paths')
}
if (/diagnostics-[^"']+\.js/.test(indexHtml)) {
  throw new Error('The diagnostics chunk must not be eagerly referenced by index.html')
}

verifyVercelConfig()

const appAssets = files.filter((filePath) => filePath.startsWith(resolve(distRoot, 'assets')))
const entryScript = appAssets.find((filePath) => /^index-[^/\\]+\.js$/.test(relative(resolve(distRoot, 'assets'), filePath)))

if (!entryScript) {
  throw new Error('Could not find the hashed application entry script')
}

const entryGzipBytes = gzipSize(entryScript)
const entryGzipBudget = 70 * 1024
if (entryGzipBytes > entryGzipBudget) {
  throw new Error(
    `Application entry exceeds gzip budget: ${formatBytes(entryGzipBytes)} > ${formatBytes(entryGzipBudget)}`,
  )
}

const totalBytes = sum(files.map((filePath) => statSync(filePath).size))
const appBytes = sum(appAssets.map((filePath) => statSync(filePath).size))
const appGzipBytes = sum(appAssets.filter(isCompressible).map(gzipSize))
const appBrotliBytes = sum(appAssets.filter(isCompressible).map(brotliSize))
const engineBytes = sum(files.filter((filePath) => filePath.startsWith(engineRoot)).map((filePath) => statSync(filePath).size))
const coreEngineFiles = [resolve(engineRoot, 'xr.js'), resolve(engineRoot, 'xr-slam.js')]
const captureWorker = resolve(engineRoot, 'resources/media-worker.js')
const coreEngineRawBytes = sum(coreEngineFiles.map((filePath) => statSync(filePath).size))
const coreEngineGzipBytes = sum(coreEngineFiles.map(gzipSize))
const coreEngineBrotliBytes = sum(coreEngineFiles.map(brotliSize))

console.log('Production build audit passed')
console.log(`- Engine path: /${enginePublicPath} (version ${engineVersion})`)
console.log(`- Application assets: ${formatBytes(appBytes)} raw / ${formatBytes(appGzipBytes)} gzip / ${formatBytes(appBrotliBytes)} Brotli`)
console.log(`- Application entry: ${formatBytes(statSync(entryScript).size)} raw / ${formatBytes(entryGzipBytes)} gzip`)
console.log(`- Placement model: /models/Logo.glb (${formatBytes(placementModelBuffer.length)})`)
console.log(`- Engine package on disk: ${formatBytes(engineBytes)}`)
console.log(`- Engine + SLAM transfer estimate: ${formatBytes(coreEngineRawBytes)} raw / ${formatBytes(coreEngineGzipBytes)} gzip / ${formatBytes(coreEngineBrotliBytes)} Brotli`)
console.log(`- Capture worker transfer estimate: ${formatBytes(statSync(captureWorker).size)} raw / ${formatBytes(gzipSize(captureWorker))} gzip / ${formatBytes(brotliSize(captureWorker))} Brotli`)
console.log(`- Complete deployment on disk: ${formatBytes(totalBytes)}`)

function listFiles(directory) {
  return readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? listFiles(path) : [path]
  })
}

function gzipSize(filePath) {
  return gzipSync(readFileSync(filePath), {level: 9}).byteLength
}

function brotliSize(filePath) {
  return brotliCompressSync(readFileSync(filePath), {
    params: {[constants.BROTLI_PARAM_QUALITY]: 11},
  }).byteLength
}

function isCompressible(filePath) {
  return new Set(['.css', '.html', '.js', '.json', '.svg']).has(extname(filePath))
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0)
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`
}

function verifyVercelConfig() {
  if (!existsSync(vercelConfigPath)) {
    throw new Error('vercel.json is required for the production hosting contract')
  }

  const config = JSON.parse(readFileSync(vercelConfigPath, 'utf8'))
  if (config.outputDirectory !== 'dist' || config.buildCommand !== 'npm run build') {
    throw new Error('vercel.json must deploy the audited dist/ produced by npm run build')
  }

  const headerRules = Array.isArray(config.headers) ? config.headers : []
  const engineRule = headerRules.find(
    (rule) => rule.source === `/${enginePublicPath}/(.*)`,
  )
  const assetRule = headerRules.find((rule) => rule.source === '/assets/(.*)')
  const modelRule = headerRules.find((rule) => rule.source === '/models/(.*)')
  const globalRule = headerRules.find((rule) => rule.source === '/(.*)')

  assertHeader(engineRule, 'Cache-Control', 'public, max-age=31536000, immutable')
  assertHeader(assetRule, 'Cache-Control', 'public, max-age=31536000, immutable')
  assertHeader(modelRule, 'Cache-Control', 'public, max-age=0, must-revalidate')
  assertHeader(globalRule, 'Content-Security-Policy-Report-Only')
  assertHeader(globalRule, 'Permissions-Policy')
  assertHeader(globalRule, 'X-Content-Type-Options', 'nosniff')
}

function assertHeader(rule, key, expectedValue) {
  const header = rule?.headers?.find((candidate) => candidate.key === key)
  if (!header || (expectedValue !== undefined && header.value !== expectedValue)) {
    throw new Error(`vercel.json is missing the required ${key} header`)
  }
}
