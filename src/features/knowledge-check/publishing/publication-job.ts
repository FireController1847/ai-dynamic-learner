import type { CheckItem } from '../library-model.ts';
import { preparePublication } from './prepare-publication.ts';
import { publicationView, copyPublicationSettings, validatePublicationSettings, type PublicationSettings, type PublicationView } from './publication-model.ts';
import { paginatePublication, type PaginatedPublication, type PublicationRenderer } from './paged-runtime.ts';

export interface PublicationJob {
  /** Answer policy has already been applied. Delivery adapters consume this view. */
  readonly view: PublicationView;
  paginate(host: HTMLElement, renderer: PublicationRenderer, signal?: AbortSignal): Promise<PaginatedPublication>;
}

/** One prepared job can feed future paged or non-paged delivery adapters. */
export async function preparePublicationJob(
  item: CheckItem, settings: PublicationSettings, signal?: AbortSignal,
): Promise<PublicationJob> {
  validatePublicationSettings(settings);
  const options = copyPublicationSettings(settings);
  const source = await preparePublication(item, options, signal);
  const view = publicationView(source, options);
  return { view, paginate: (host, renderer, paginationSignal) =>
    paginatePublication(host, view, renderer, paginationSignal) };
}
