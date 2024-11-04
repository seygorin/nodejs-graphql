import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
import { graphql, validate, parse } from 'graphql';
import { schema } from './schema.js';
import depthLimit from 'graphql-depth-limit';
import { addLoadersToContext } from './loaders.js';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { prisma } = fastify;

  fastify.route({
    url: '/',
    method: 'POST',
    schema: {
      ...createGqlResponseSchema,
      response: {
        200: gqlResponseSchema,
      },
    },
    async handler(req) {
      const { query, variables } = req.body;

      const queryDocument = parse(query);
      const validationErrors = validate(schema, queryDocument, [depthLimit(5)]);

      if (validationErrors.length > 0) {
        return { errors: validationErrors };
      }

      const result = await graphql({
        schema,
        source: query,
        variableValues: variables,
        contextValue: addLoadersToContext(prisma),
      });

      return result;
    },
  });
};

export default plugin;
