const { buildSchema } = require('graphql');

module.exports = buildSchema(`
    type User {
        _id: ID!
        name: String!
        email: String!
        password: String
        passwordConfirm: String
        role: String
        photo: String
    }

    input UserData {
        email: String!
        name: String!
        password: String!
        passwordConfirm: String!
    }

    type RootQuery {
        hello: String
    }

    type RootMutation {
        createUser(userInput: UserData): User
    }

    schema {
        query: RootQuery
        mutation: RootMutation
    }
`);
