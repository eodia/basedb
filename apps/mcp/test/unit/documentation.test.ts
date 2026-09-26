import { DOCUMENTED_MCP_TOOLS } from '@basedb/core'
import { describe, expect, it } from 'vitest'
import { TOOLS } from '../../src/tools.js'

/**
 * The generated documentation lists the MCP tools, and the kernel that writes it may not
 * import this package. So the two lists are held together here: a tool declared and not
 * documented — or documented and gone — fails this test instead of misleading a reader.
 */
describe('the tools the documentation describes', () => {
  it('are exactly the tools this server declares, in the same order', () => {
    expect(DOCUMENTED_MCP_TOOLS.map((t) => t.name)).toEqual(TOOLS.map((t) => t.name))
  })

  it('say they write — or propose — exactly when the server says they are not read-only', () => {
    for (const tool of TOOLS) {
      const documented = DOCUMENTED_MCP_TOOLS.find((t) => t.name === tool.name)
      const writes =
        documented?.needs !== undefined &&
        ['create', 'update', 'propose'].includes(documented.needs)
      expect({ tool: tool.name, writes }).toEqual({
        tool: tool.name,
        writes: tool.annotations.readOnlyHint !== true,
      })
    }
  })
})
