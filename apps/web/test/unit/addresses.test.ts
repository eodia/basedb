import { describe, expect, it } from 'vitest'
import { absoluteAddress } from '../../src/lib/api/client'

describe('absoluteAddress', () => {
  it('keeps an absolute address, without its trailing slash', () => {
    expect(absoluteAddress('http://localhost:8787')).toBe('http://localhost:8787')
    expect(absoluteAddress('https://basedb.example.com/')).toBe('https://basedb.example.com')
  })

  it("resolves an address starting with / against the page's origin", () => {
    // The Docker image: the API at `/`, the MCP entry point at `/mcp`, on one address.
    expect(absoluteAddress('/', 'https://basedb.example.com')).toBe('https://basedb.example.com')
    expect(absoluteAddress('/mcp', 'http://192.168.1.20:3000')).toBe('http://192.168.1.20:3000/mcp')
    expect(absoluteAddress('/mcp/', 'http://localhost:3000')).toBe('http://localhost:3000/mcp')
  })
})
