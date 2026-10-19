import { LogController, type FastifyReply, type FastifyRequest } from 'fastify'
import { HTTP_STATUS } from '../http-status'
import { LogOperation } from './types'

export class DiagnosticLogController extends LogController {
  // incomingRequest() normally logs every incoming request.
  // The empty override keeps routine traffic quiet.
  incomingRequest() {}

  // routeNotFound() normally logs unmatched URLs.
  // The empty override avoids that noise and prevents raw URLs or query values from entering logs.
  routeNotFound() {}

  requestCompleted(error: Error | null | undefined, request: FastifyRequest, reply: FastifyReply) {
    if (error) this.logFailure(error, request, reply, LogOperation.enum.response)
  }

  defaultErrorLog(error: Error, request: FastifyRequest, reply: FastifyReply) {
    if (reply.statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR)
      this.logFailure(error, request, reply, LogOperation.enum.handler)
  }

  streamError(error: Error, request: FastifyRequest, reply: FastifyReply) {
    this.logFailure(error, request, reply, LogOperation.enum['response-stream'])
  }

  writeHeadError(error: Error, request: FastifyRequest, reply: FastifyReply) {
    this.logFailure(error, request, reply, LogOperation.enum['response-headers'])
  }

  serializerError(error: Error, request: FastifyRequest, reply: FastifyReply) {
    this.logFailure(error, request, reply, LogOperation.enum['response-serialization'])
  }

  private logFailure(
    error: Error,
    request: FastifyRequest,
    reply: FastifyReply,
    operation: LogOperation,
  ) {
    request.log.error({ req: request, res: reply, err: error, operation }, 'HTTP operation failed')
  }
}
