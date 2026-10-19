import { type FastifyPluginAsync } from 'fastify'
import fastifyStatic from '@fastify/static'
import { statSync } from 'node:fs'
import { resolve } from 'node:path'

export type RootOptions = { frontendRoot?: string | false }

const root: FastifyPluginAsync<RootOptions> = async (fastify, options): Promise<void> => {
  const frontendRoot =
    options.frontendRoot ??
    (process.env.NODE_ENV === 'production' ? resolve(__dirname, '../../../web/dist') : false)

  if (frontendRoot === false) {
    fastify.get('/', async () => ({ root: true }))
    return
  }

  if (!statSync(resolve(frontendRoot, 'index.html'), { throwIfNoEntry: false })?.isFile())
    throw new Error('Production frontend build is missing')

  await fastify.register(fastifyStatic, {
    root: frontendRoot,
    wildcard: false,
    dotfiles: 'deny',
    cacheControl: false,
  })
}

export default root
