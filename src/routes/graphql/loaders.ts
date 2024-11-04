import DataLoader from 'dataloader';
import { PrismaClient } from '@prisma/client';

export const createMemberTypeLoader = (prisma: PrismaClient) => {
  return new DataLoader(async (ids: readonly string[]) => {
    const memberTypes = await prisma.memberType.findMany({
      where: { id: { in: [...ids] } },
    });
    return ids.map((id) => memberTypes.find((mt) => mt.id === id));
  });
};

export const createPostLoader = (prisma: PrismaClient) => {
  return new DataLoader(async (authorIds: readonly string[]) => {
    const posts = await prisma.post.findMany({
      where: { authorId: { in: [...authorIds] } },
    });
    
    const postsByAuthor = authorIds.map((authorId) => 
      posts.filter((post) => post.authorId === authorId)
    );
    
    return postsByAuthor;
  });
};

export const createProfileLoader = (prisma: PrismaClient) => {
  return new DataLoader(async (userIds: readonly string[]) => {
    const profiles = await prisma.profile.findMany({
      where: { userId: { in: [...userIds] } },
    });
    return userIds.map((id) => profiles.find((p) => p.userId === id));
  });
};

export const createUserLoader = (prisma: PrismaClient) => {
  return new DataLoader(async (ids: readonly string[]) => {
    const users = await prisma.user.findMany({
      where: { id: { in: [...ids] } },
    });
    return ids.map((id) => users.find((u) => u.id === id));
  });
};

export const addLoadersToContext = (prisma: PrismaClient) => ({
  prisma,
  memberTypeLoader: createMemberTypeLoader(prisma),
  postLoader: createPostLoader(prisma),
  profileLoader: createProfileLoader(prisma),
  userLoader: createUserLoader(prisma),
}); 