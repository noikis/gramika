import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { fromNodeHeaders } from 'better-auth/node'
import type { FastifyInstance } from 'fastify'
import type { SqliteDatabase } from './database/sqlite-database'

export function createAuth(database: SqliteDatabase, environment: Record<string, string | undefined>) {
  const baseURL = environment.BETTER_AUTH_URL?.trim()
  if (!baseURL) throw new Error('BETTER_AUTH_URL is required when authentication is enabled')
  const trustedOrigins = [
    baseURL,
    environment.WEB_ORIGIN?.trim(),
  ]
    .filter((value): value is string => Boolean(value))

  return betterAuth({
    database: drizzleAdapter(database.drizzle, { provider: 'sqlite' }),
    baseURL,
    secret: environment.BETTER_AUTH_SECRET,
    trustedOrigins,
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    socialProviders: {
      google: {
        clientId: environment.GOOGLE_CLIENT_ID || '',
        clientSecret: environment.GOOGLE_CLIENT_SECRET || '',
      },
    },
  })
}

export function registerAuthRoutes(
  fastify: FastifyInstance,
  auth: ReturnType<typeof createAuth>,
  baseURL: string,
) {
  fastify.all('/api/auth/*', async (request, reply) => {
    const headers = fromNodeHeaders(request.headers)
    let body: string | undefined
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.body !== undefined) {
      body = JSON.stringify(request.body)
      headers.set('content-type', 'application/json')
    }
    const webRequest = new Request(new URL(request.raw.url ?? '/', baseURL), {
      method: request.method,
      headers,
      body,
    })
    const response = await auth.handler(webRequest)
    response.headers.forEach((value, key) => reply.header(key, value))
    return reply.code(response.status).send(await response.text())
  })
  fastify.get('/api/me', async (request, reply) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) })
    if (!session) return reply.code(401).send({ error: 'Unauthorized' })
    return { user: session.user, session: session.session }
  })
  fastify.addHook('onRequest', async (request) => {
    if (
      request.url.startsWith('/api/auth/') ||
      request.url === '/api/me' ||
      request.url === '/api/health'
    )
      return
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) })
    request.authUserId = session?.user.id
    if (request.url.startsWith('/api/') && !request.authUserId) {
      const error = new Error('Unauthorized')
      Object.assign(error, { statusCode: 401 })
      throw error
    }
  })
}
