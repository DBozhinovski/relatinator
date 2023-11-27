# Relatinator

A humble library for finding related posts and content. Uses tf-idf under the hood. Primarily aimed at static site generators.

- Based on [vite-vanilla-ts-lib-starter](https://github.com/kbysiec/vite-vanilla-ts-lib-starter/tree/master).
- Using [natural](https://naturalnode.github.io/natural/) under the hood.

## Motivation

My ["corner of the internet"](https://darko.io) was lacking a related posts section, and as usual, my first reflex was to try to find something off-the-shelf. After a couple of tries, I realized there was nothing suitable for this particular use case - a static-site for which the related post classification has to happen at build time.

One approach would be to use a third-party service (plenty of those out there), but I'll admit I'm a bit allergic to external dependencies for relatively simple problem spaces (I mean c'mon, it's a blog, not a rocket ship). So, I decided to build my own.

Full post describing the process here: https://darko.io/posts/build-you-a-related-post-classifier

## Features

- Train a tf-idf classifier with your content
- Get N related posts for a given post as input

## Usage

### Installation

```bash
npm i relatinator
```

### Training

Before you can get related posts, you need to train the TF-IDF with your content. To that end, the library exposes a `train` function that takes an array of documents as input. A document is defined as an object with an `id` and `content` property:

- `id` - a unique identifier for the document
- `content` - the contents of the document; These are expected to be a string. You can, however, concatenate any metadata, descriptions or anything else you might want to use for matching.

```ts
import { train } from 'relatinator';

const documents = [
  {
    id: '1',
    content: 'This is the first document',
  },
  {
    id: '2',
    content: 'This is the second document',
  },
  {
    id: '3',
    content: 'This is the third document',
  },
];

train(documents);
```

### Getting related posts

Once you've trained the classifier, you can get related posts for a given post by using the `getRelated` function. It takes the following arguments:

- `documentToCompare` - the content of the post for which you want to get related posts
- `id` - the id of the post for which you want to get related posts
- `topN` - the number of related posts you want to get

```ts

import { train, getRelated } from 'relatinator';

const documents = [
  {
    id: '1',
    content: 'This is the first document',
  },
  {
    id: '2',
    content: 'This is the second document',
  },
  {
    id: '3',
    content: 'This is the third document',
  },
];

train(documents);

// Get the top 2 related posts for something
const related = getRelated('This is the first document', '1', 2);
```

## Roadmap

- [ ] Reduce bundle size (natural isn't too tree-shakeable)
- [ ] Add practical examples

## Acknowledgment

If you found it useful somehow, I would be grateful if you could leave a star in the project's GitHub repository.

Thank you.
