# Future ideas

This document captures possible future product directions that are not yet committed architecture or requirements. Ideas here may change, merge, or be discarded as Dynamic Learner evolves.

## Learning lifecycle

Explore organizing Dynamic Learner around three major stages:

```text
Learn -> Practice -> Test
```

### Learn

The initial acquisition stage. Introduce new material, explain concepts, demonstrate examples, and help the learner form an initial mental model before expecting independent recall.

This stage should address the gap that appears when study material is generated or prepared by someone else: the learner may have cards, notes, or questions without having done the encoding work that normally happens while creating them.

### Practice

The broad skill-building and retention stage. Practice would contain three progressively less-supported modes:

```text
Guide -> Study -> Review
```

- **Guide** — highly supported walkthroughs of the material. Emphasize context, explanation, examples, and structured progression.
- **Study** — active practice while knowledge is still developing. Allow hints, retries, explanations, flexible answer checking, and other learning-oriented assistance.
- **Review** — retrieval and retention after the material is reasonably familiar. Reduce scaffolding and emphasize recall, weak-area resurfacing, and repeated retrieval over time.

Guide, Study, and Review may share substantial underlying infrastructure while differing primarily in their learning goals, defaults, and amount of assistance.

### Test

The independent assessment stage. Measure what the learner can demonstrate without instructional support. Test may reuse question/rendering/scoring infrastructure from Practice while applying assessment-oriented rules such as no hints, limited retries, delayed feedback, timing, or fixed session settings.

## Design direction

The stages should describe the learner's relationship to the material rather than force every Dynamic Learner feature into a separate implementation.

A possible long-term flow is:

```text
Learn
  |
  v
Practice
  |- Guide
  |- Study
  '- Review
  |
  v
Test
```

As the learner progresses, instructional scaffolding generally decreases while independent retrieval increases.

The exact UI, navigation, data model, automatic progression rules, and relationship between existing apps are intentionally undecided.
