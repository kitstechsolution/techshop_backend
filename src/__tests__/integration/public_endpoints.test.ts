import request from 'supertest'
import app from '../../app.js'
import '../setup'

const requestAny = request as any

describe('Public endpoints accessibility', () => {
  it('GET /api/content/settings is public', async () => {
    const res = await requestAny(app).get('/api/content/settings').expect(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.company?.name).toBeDefined()
  })

  it('GET /api/content/last-modified is public', async () => {
    const res = await requestAny(app).get('/api/content/last-modified').expect(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.lastModified).toBeDefined()
  })

  it('GET /api/themes/active is public', async () => {
    const res = await requestAny(app).get('/api/themes/active').expect(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.type).toBeDefined()
  })
})
