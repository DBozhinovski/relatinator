# Relatinator

<p align="center">
  <img src="https://raw.githubusercontent.com/DBozhinovski/relatinator/master/logo.svg" />
</p>

A humble library for finding related posts and content. Uses tf-idf under the hood. Primarily aimed at static site generators.

- Based on [vite-vanilla-ts-lib-starter](https://github.com/kbysiec/vite-vanilla-ts-lib-starter/tree/master).
- Using [natural](https://naturalnode.github.io/natural/) under the hood.

## Motivation

My ["corner of the internet"](https://darko.io) was lacking a related posts section, and as usual, my first reflex was to try to find something off the shelf. After a couple of tries, I realized nothing was suitable for this particular use case - a static site for which the related post classification must happen at build time.

One approach would be to use a third-party service (plenty of those out there), but I'm a bit allergic to external dependencies for relatively simple problem spaces (I mean, c'mon, it's a blog, not a rocket ship). So, I decided to build my own.

Full post describing the process here: https://darko.io/posts/build-you-a-related-post-classifier

## Features

- Train a tf-idf classifier with your content
- Get N-related posts for a given documents as input
- Get top N keywords for a given documents id as input
- Get top related documents for a given term

## Usage

### Installation

```bash
npm i relatinator
```

### Training

Before you can get related documents, you need to train the TF-IDF with your content. To that end, the library exposes a `train` function that takes an array of documents as input. A document is defined as an object with an `id` and `content` property:

- `id` - a unique identifier for the document
- `content` - the document's contents; These are expected to be a string. You can concatenate any metadata, descriptions, or anything else you might want to use for matching.

```ts
import { train } from "relatinator";

const documents = [
  {
    id: "1",
    content: "This is the first document",
  },
  {
    id: "2",
    content: "This is the second document",
  },
  {
    id: "3",
    content: "This is the third document",
  },
];

train(documents);
```

### Getting related documents

Once you've trained the classifier, you can get related documents for a given document by using the `getRelated` function. It takes the following arguments:

- `documentToCompare` - the content of the document for which you want to get related documents
- `id` - the id of the document for which you want to get related documents
- `topN` - the number of related documents you want to get

```ts
import { train, getRelated } from "relatinator";

const documents = [
  {
    id: "1",
    content: "This is the first document",
  },
  {
    id: "2",
    content: "This is the second document",
  },
  {
    id: "3",
    content: "This is the third document",
  },
];

train(documents);

// Get the top 2 related posts for something
const related = getRelated("This is the first document", "1", 2);
```

### Getting top keywords for a document

You can also get the top keywords for a given document id by using the `getTopTerms` function. It takes the following arguments:

- `id` - the id of the document you want to get top terms for
- `topN` - the number of top terms you want to get

```ts
// Assuming you've already trained the classifier
import { getTopTerms } from "relatinator";

getTopTerms("your-doc-id-here", 2);

// Example output:
// -> [{ term: 'term1', tfidf: 0.123 }, { term: 'term2', tfidf: 0.456 }]
```

### Getting top related documents for a term

Getting top related documents for a term is also possible. You can use the `getTopRelatedDocumentsForTerm` function. It takes the following arguments:

- `term` - the term you want to get top related documents for
- `topN` - the number of top related documents you want to get

```ts
import { getTopRelatedDocumentsForTerm } from "relatinator";

getTopRelatedDocumentsForTerm("term", 2);

// Example output:
// -> ["doc-id-1", "doc-id-2"]
```

## Roadmap

- [x] ~Reduce bundle size (natural isn't too tree-shakeable).~ Externalized it and made it a peer dep in v 1.0.3.
- [ ] Add practical examples
- [x] ~Add support for extracting top N keywords from a document (possible utility with automated tagging and linking)~ Added in v1.1.0.
- [ ] Add summarization support (useful for auto-generated descriptions); Will likely have to use Transfromers for this one.
- [x] ~Migrate to monorepo and add Astro integration~ Added in v1.2.0.

## Acknowledgment

If you found it useful, I would be grateful if you could leave a star in the project's GitHub repository.

Thank you.
