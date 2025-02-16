import { findRelated, getInstance, train } from "relatinator";
import { getCollection } from "astro:content";

export const relatinator = getInstance();
const posts = await getCollection("posts");

export const trainRelatinator = async () => {
  train(
    posts.map((post) => ({
      id: post.id,
      content: `${post.data.title} ${post.data.categories.join(
        " "
      )} ${post.data.tags.join(" ")} ${post.body}`,
    })),
    true
  );
};

export const getRelatedPosts = async (postId: string, topN: number = 3) => {
  const post = posts.find((post) => post.id === postId);
  if (!post) {
    throw new Error(`Post with id ${postId} not found`);
  }
  const relatedIds = await findRelated(
    `${post.data.title} ${post.data.categories.join(" ")} ${post.data.tags.join(
      " "
    )} ${post.body}`,
    postId,
    topN,
    true
  );

  console.log("relatedIds", relatedIds);

  return relatedIds.map((id) => posts.find((p) => p.id === id));
};
