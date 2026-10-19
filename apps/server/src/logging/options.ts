import type { FastifyServerOptions } from 'fastify'
import { DiagnosticLogController } from './log-controller'
import { LogLevel } from './types'

export const loggingOptions: FastifyServerOptions = {
  logController: new DiagnosticLogController(),
  logger: {
    level: LogLevel.enum.info,
    serializers: {
      req: (request) => ({ method: request.method, route: request.routeOptions?.url }),
      res: (reply) => ({ statusCode: reply.statusCode }),
      err: () => ({
        type: 'Error',
        message: 'Exception details omitted',
        stack: '',
      }),
    },
  },
}
