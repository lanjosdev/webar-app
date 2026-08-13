const input = process.argv[2] ?? process.env.DEPLOYMENT_URL

if (!input) {
  throw new Error(
    'Provide the HTTPS deployment URL: npm run verify:deployment -- https://example.vercel.app/',
  )
}

const baseUrl = new URL(input)
if (baseUrl.protocol !== 'https:') {
  throw new Error('The production WebAR deployment must use HTTPS')
}

const immutableCache = 'public, max-age=31536000, immutable'
const revalidatedCache = 'public, max-age=0, must-revalidate'
const root = await request('/', 'GET')
const html = await root.text()

assertEqual(root.headers.get('cache-control'), revalidatedCache, '/ cache')
assertIncludes(root.headers.get('content-type'), 'text/html', '/ content type')
assertHeader(root, 'content-security-policy-report-only')
assertHeader(root, 'permissions-policy')
assertEqual(root.headers.get('x-content-type-options'), 'nosniff', '/ nosniff')
assertEqual(root.headers.get('x-frame-options'), 'DENY', '/ frame policy')
assertEqual(root.headers.get('referrer-policy'), 'strict-origin-when-cross-origin', '/ referrer policy')
assertIncludes(html, '/external/xr/v1.0.0/xr.js', 'versioned Engine script')

const assetPaths = [...html.matchAll(/(?:src|href)="([^"?]+\.(?:js|css))"/g)]
  .map((match) => match[1])
  .filter((path) => path.startsWith('/assets/'))
const representativeAsset = assetPaths.find((path) => path.includes('/three-')) ?? assetPaths[0]

if (!representativeAsset) {
  throw new Error('Could not find a production asset in index.html')
}

const asset = await request(representativeAsset)
assertEqual(asset.headers.get('cache-control'), immutableCache, `${representativeAsset} cache`)
assertCompression(asset, representativeAsset)

const placementModel = await request('/models/Logo.glb', 'GET')
assertEqual(
  placementModel.headers.get('cache-control'),
  revalidatedCache,
  '/models/Logo.glb cache',
)
assertIncludes(
  placementModel.headers.get('content-type'),
  'model/gltf-binary',
  '/models/Logo.glb content type',
)
const placementModelBuffer = Buffer.from(await placementModel.arrayBuffer())
if (
  placementModelBuffer.length < 12 ||
  placementModelBuffer.toString('ascii', 0, 4) !== 'glTF' ||
  placementModelBuffer.readUInt32LE(4) !== 2 ||
  placementModelBuffer.readUInt32LE(8) !== placementModelBuffer.length
) {
  throw new Error('/models/Logo.glb is not a valid glTF 2.0 binary')
}

const engineResources = [
  ['/external/xr/v1.0.0/xr.js', 'application/javascript', true],
  ['/external/xr/v1.0.0/xr-slam.js', 'application/javascript', true],
  ['/external/xr/v1.0.0/resources/media-worker.js', 'application/javascript', true],
  ['/external/xr/v1.0.0/LICENSE', 'application/octet-stream', false],
]

for (const [path, contentType, compressed] of engineResources) {
  const response = await request(path)
  assertEqual(response.headers.get('cache-control'), immutableCache, `${path} cache`)
  assertIncludes(response.headers.get('content-type'), contentType, `${path} content type`)
  if (compressed) {
    assertCompression(response, path)
  }
}

console.log(`Vercel deployment contract verified: ${baseUrl.origin}`)

async function request(path, method = 'HEAD') {
  const response = await fetch(new URL(path, baseUrl), {
    headers: {'Accept-Encoding': 'br, gzip'},
    method,
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`)
  }

  return response
}

function assertCompression(response, label) {
  const encoding = response.headers.get('content-encoding')
  if (encoding !== 'br' && encoding !== 'gzip') {
    throw new Error(`${label} was not served with Brotli or gzip`)
  }
}

function assertHeader(response, key) {
  if (!response.headers.get(key)) {
    throw new Error(`/ is missing ${key}`)
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual ?? '<missing>'}`)
  }
}

function assertIncludes(actual, expected, label) {
  if (!actual?.includes(expected)) {
    throw new Error(`${label}: expected ${expected}, received ${actual ?? '<missing>'}`)
  }
}
