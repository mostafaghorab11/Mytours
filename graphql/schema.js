const { buildSchema } = require('graphql');

const schema = buildSchema(
  `
  type TestData {
    text: String!
    views: Int!
  }

  type RootQuery {
    hello: TestData!
  }

  schema {
    query: RootQuery
  }
    `
);

module.exports = schema;
