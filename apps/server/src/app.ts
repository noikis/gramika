import { join } from 'node:path'
import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload'
import { FastifyPluginAsync, FastifyServerOptions } from 'fastify'
import { correctionApi, type CorrectionOptions } from './correction-api'

export interface AppOptions extends FastifyServerOptions, Partial<AutoloadPluginOptions> {
  correction?: CorrectionOptions
}
const options: AppOptions = {}

const app: FastifyPluginAsync<AppOptions> = async (fastify, opts): Promise<void> => {
  await correctionApi(fastify, opts.correction)

  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    options: opts,
  })
}

export default app
export { app, options }
