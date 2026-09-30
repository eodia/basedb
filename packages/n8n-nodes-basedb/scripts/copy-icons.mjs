// n8n reads each node's icon beside its compiled file: the logo goes next to every node and
// every credential.
import { copyFileSync, mkdirSync } from 'node:fs'

const logo = new URL('../icons/basedb.svg', import.meta.url)
for (const dir of [
  'dist/nodes/Basedb',
  'dist/nodes/BasedbTrigger',
  'dist/nodes/BasedbWebhookTrigger',
  'dist/credentials',
]) {
  mkdirSync(new URL(`../${dir}/`, import.meta.url), { recursive: true })
  copyFileSync(logo, new URL(`../${dir}/basedb.svg`, import.meta.url))
}
