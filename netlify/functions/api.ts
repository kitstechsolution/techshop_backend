import type { Handler } from "@netlify/functions"
import serverless from "serverless-http"
import app from "../../src/app"

const expressHandler = serverless(app)

export const handler: Handler = async (event, context) => {
  return await expressHandler(event, context)
}
