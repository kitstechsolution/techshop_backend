import type { Handler } from "@netlify/functions"
import serverless from "serverless-http"
import app from "../../src/app"

const expressHandler = serverless(app)

export const config = {
  path: ['/api/*']
}

export const handler: Handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) as string | undefined;
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Vary': 'Origin'
      },
      body: ''
    } as any;
  }
  try {
    return await expressHandler(event, context)
  } catch (error) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) as string | undefined;
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Credentials': 'true',
        'Vary': 'Origin',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Internal Server Error' })
    } as any;
  }
}
