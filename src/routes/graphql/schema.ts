/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prefer-const */

import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLFloat,
  GraphQLInt,
  GraphQLBoolean,
  GraphQLNonNull,
  GraphQLList,
  GraphQLEnumType,
  GraphQLInputObjectType,
} from 'graphql';
import { UUIDType } from './types/uuid.js';
import { parse, ResolveTree, simplify } from 'graphql-parse-resolve-info';

const MemberTypeIdEnum = new GraphQLEnumType({
  name: 'MemberTypeId',
  values: {
    BASIC: { value: 'BASIC' },
    BUSINESS: { value: 'BUSINESS' },
  },
});

let UserType: GraphQLObjectType;

const MemberType = new GraphQLObjectType({
  name: 'MemberType',
  fields: {
    id: { type: new GraphQLNonNull(MemberTypeIdEnum) },
    discount: { type: new GraphQLNonNull(GraphQLFloat) },
    postsLimitPerMonth: { type: new GraphQLNonNull(GraphQLInt) },
  },
});

const Post = new GraphQLObjectType({
  name: 'Post',
  fields: {
    id: { type: new GraphQLNonNull(UUIDType) },
    title: { type: new GraphQLNonNull(GraphQLString) },
    content: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const Profile = new GraphQLObjectType({
  name: 'Profile',
  fields: () => ({
    id: { type: new GraphQLNonNull(UUIDType) },
    isMale: { type: new GraphQLNonNull(GraphQLBoolean) },
    yearOfBirth: { type: new GraphQLNonNull(GraphQLInt) },
    memberType: {
      type: new GraphQLNonNull(MemberType),
      resolve: async (parent: any, _, { memberTypeLoader }) => {
        return memberTypeLoader.load(parent.memberTypeId);
      },
    },
  }),
});

UserType = new GraphQLObjectType({
  name: 'User',
  fields: () => ({
    id: { type: new GraphQLNonNull(UUIDType) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    balance: { type: new GraphQLNonNull(GraphQLFloat) },
    profile: {
      type: Profile,
      resolve: async (parent: any, _, { profileLoader }) => {
        return profileLoader.load(parent.id);
      },
    },
    posts: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(Post))),
      resolve: async (parent: any, _, { postLoader }) => {
        return postLoader.load(parent.id);
      },
    },
    userSubscribedTo: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(UserType))),
      resolve: async (parent, _, { prisma, userLoader }) => {
        if (!parent?.userSubscribedTo) {
          const subscriptions = await prisma.subscribersOnAuthors.findMany({
            where: {
              subscriberId: parent.id
            }
          });
          return Promise.all(subscriptions.map(sub => userLoader.load(sub.authorId)));
        }
        return Promise.all(parent.userSubscribedTo.map(sub => userLoader.load(sub.authorId)));
      },
    },
    subscribedToUser: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(UserType))),
      resolve: async (parent, _, { prisma, userLoader }) => {
        if (!parent?.subscribedToUser) {
          const subscribers = await prisma.subscribersOnAuthors.findMany({
            where: {
              authorId: parent.id
            }
          });
          return Promise.all(subscribers.map(sub => userLoader.load(sub.subscriberId)));
        }
        return Promise.all(parent.subscribedToUser.map(sub => userLoader.load(sub.subscriberId)));
      },
    },
  }),
});

const CreateUserInput = new GraphQLInputObjectType({
  name: 'CreateUserInput',
  fields: {
    name: { type: new GraphQLNonNull(GraphQLString) },
    balance: { type: new GraphQLNonNull(GraphQLFloat) },
  },
});

const CreateProfileInput = new GraphQLInputObjectType({
  name: 'CreateProfileInput',
  fields: {
    isMale: { type: new GraphQLNonNull(GraphQLBoolean) },
    yearOfBirth: { type: new GraphQLNonNull(GraphQLInt) },
    userId: { type: new GraphQLNonNull(UUIDType) },
    memberTypeId: { type: new GraphQLNonNull(MemberTypeIdEnum) },
  },
});

const CreatePostInput = new GraphQLInputObjectType({
  name: 'CreatePostInput',
  fields: {
    title: { type: new GraphQLNonNull(GraphQLString) },
    content: { type: new GraphQLNonNull(GraphQLString) },
    authorId: { type: new GraphQLNonNull(UUIDType) },
  },
});

const ChangeUserInput = new GraphQLInputObjectType({
  name: 'ChangeUserInput',
  fields: {
    name: { type: GraphQLString },
    balance: { type: GraphQLFloat },
  },
});

const ChangeProfileInput = new GraphQLInputObjectType({
  name: 'ChangeProfileInput',
  fields: {
    isMale: { type: GraphQLBoolean },
    yearOfBirth: { type: GraphQLInt },
    memberTypeId: { type: MemberTypeIdEnum },
  },
});
const ChangePostInput = new GraphQLInputObjectType({
  name: 'ChangePostInput',
  fields: {
    title: { type: GraphQLString },
    content: { type: GraphQLString },
  },
});

const RootQueryType = new GraphQLObjectType({
  name: 'RootQueryType',
  fields: {
    memberTypes: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(MemberType))),
      resolve: async (_, __, context) => {
        return context.prisma.memberType.findMany();
      },
    },
    memberType: {
      type: MemberType,
      args: {
        id: { type: new GraphQLNonNull(MemberTypeIdEnum) },
      },
      resolve: async (_, args, context) => {
        return context.prisma.memberType.findUnique({
          where: { id: args.id },
        });
      },
    },
    users: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(UserType))),
      resolve: async (parent, args, { prisma, userLoader }, info) => {
        const parsedInfo = parse(info);
        const { fields } = simplify(parsedInfo as ResolveTree, new GraphQLList(UserType));

        const users = await prisma.user.findMany({
          include: {
            subscribedToUser: 'subscribedToUser' in fields,
            userSubscribedTo: 'userSubscribedTo' in fields,
          },
        });

        // Prime the loader with the fetched users
        users.forEach((user) => userLoader.prime(user.id, user));

        return users;
      },
    },
    user: {
      type: UserType,
      args: {
        id: { type: new GraphQLNonNull(UUIDType) },
      },
      async resolve(parent, { id }, { prisma }, info) {
        const parsedInfo = parse(info);
        const { fields } = simplify(parsedInfo as ResolveTree, UserType);

        const user = await prisma.user.findUnique({
          where: { id },
          include: {
            subscribedToUser: 'subscribedToUser' in fields,
            userSubscribedTo: 'userSubscribedTo' in fields,
          },
        });

        if (!user) return null;
        return user;
      },
    },
    posts: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(Post))),
      resolve: async (_, __, context) => {
        return context.prisma.post.findMany();
      },
    },
    post: {
      type: Post,
      args: {
        id: { type: new GraphQLNonNull(UUIDType) },
      },
      resolve: async (_, args, context) => {
        return context.prisma.post.findUnique({
          where: { id: args.id },
        });
      },
    },
    profiles: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(Profile))),
      resolve: async (_, __, context) => {
        return context.prisma.profile.findMany();
      },
    },
    profile: {
      type: Profile,
      args: {
        id: { type: new GraphQLNonNull(UUIDType) },
      },
      resolve: async (_, args, context) => {
        return context.prisma.profile.findUnique({
          where: { id: args.id },
        });
      },
    },
  },
});

const Mutations = new GraphQLObjectType({
  name: 'Mutations',
  fields: {
    createUser: {
      type: new GraphQLNonNull(UserType),
      args: {
        dto: { type: new GraphQLNonNull(CreateUserInput) },
      },
      resolve: async (_, args, context) => {
        return context.prisma.user.create({
          data: args.dto,
        });
      },
    },
    createProfile: {
      type: new GraphQLNonNull(Profile),
      args: {
        dto: { type: new GraphQLNonNull(CreateProfileInput) },
      },
      resolve: async (_, args, context) => {
        return context.prisma.profile.create({
          data: args.dto,
        });
      },
    },
    createPost: {
      type: new GraphQLNonNull(Post),
      args: {
        dto: { type: new GraphQLNonNull(CreatePostInput) },
      },
      resolve: async (_, args, context) => {
        return context.prisma.post.create({
          data: args.dto,
        });
      },
    },
    changePost: {
      type: new GraphQLNonNull(Post),
      args: {
        id: { type: new GraphQLNonNull(UUIDType) },
        dto: { type: new GraphQLNonNull(ChangePostInput) },
      },
      resolve: async (_, args, context) => {
        return context.prisma.post.update({
          where: { id: args.id },
          data: args.dto,
        });
      },
    },
    changeProfile: {
      type: new GraphQLNonNull(Profile),
      args: {
        id: { type: new GraphQLNonNull(UUIDType) },
        dto: { type: new GraphQLNonNull(ChangeProfileInput) },
      },
      resolve: async (_, args, context) => {
        return context.prisma.profile.update({
          where: { id: args.id },
          data: args.dto,
        });
      },
    },
    changeUser: {
      type: new GraphQLNonNull(UserType),
      args: {
        id: { type: new GraphQLNonNull(UUIDType) },
        dto: { type: new GraphQLNonNull(ChangeUserInput) },
      },
      resolve: async (_, args, context) => {
        return context.prisma.user.update({
          where: { id: args.id },
          data: args.dto,
        });
      },
    },
    deleteUser: {
      type: new GraphQLNonNull(GraphQLString),
      args: {
        id: { type: new GraphQLNonNull(UUIDType) },
      },
      resolve: async (_, args, context) => {
        await context.prisma.user.delete({
          where: { id: args.id },
        });
        return 'User deleted';
      },
    },
    deletePost: {
      type: new GraphQLNonNull(GraphQLString),
      args: {
        id: { type: new GraphQLNonNull(UUIDType) },
      },
      resolve: async (_, args, context) => {
        await context.prisma.post.delete({
          where: { id: args.id },
        });
        return 'Post deleted';
      },
    },
    deleteProfile: {
      type: new GraphQLNonNull(GraphQLString),
      args: {
        id: { type: new GraphQLNonNull(UUIDType) },
      },
      resolve: async (_, args, context) => {
        await context.prisma.profile.delete({
          where: { id: args.id },
        });
        return 'Profile deleted';
      },
    },
    subscribeTo: {
      type: new GraphQLNonNull(GraphQLString),
      args: {
        userId: { type: new GraphQLNonNull(UUIDType) },
        authorId: { type: new GraphQLNonNull(UUIDType) },
      },
      resolve: async (_, args, context) => {
        await context.prisma.subscribersOnAuthors.create({
          data: {
            subscriberId: args.userId,
            authorId: args.authorId,
          },
        });
        return 'Subscribed';
      },
    },
    unsubscribeFrom: {
      type: new GraphQLNonNull(GraphQLString),
      args: {
        userId: { type: new GraphQLNonNull(UUIDType) },
        authorId: { type: new GraphQLNonNull(UUIDType) },
      },
      resolve: async (_, args, context) => {
        await context.prisma.subscribersOnAuthors.delete({
          where: {
            subscriberId_authorId: {
              subscriberId: args.userId,
              authorId: args.authorId,
            },
          },
        });
        return 'Unsubscribed';
      },
    },
  },
});

export const schema = new GraphQLSchema({
  query: RootQueryType,
  mutation: Mutations,
});
