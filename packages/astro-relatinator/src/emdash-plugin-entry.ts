// The sandbox entry of the `astro-relatinator/emdash-plugin` descriptor.
// It is a standard-format plugin, so EmDash calls its routes with
// `(routeCtx, ctx)`. The types below are the parts of `emdash/plugin`
// that it uses, so the module has no runtime import of `emdash`.
import {
  suggestTerms,
  termDescription,
  topicText,
  type TaxonomyTerms,
  type TermInfo,
  type TermSuggestion,
} from "./emdash-topics.js";

/** The saved entry that EmDash attaches to an editor panel request. */
interface PanelEntry {
  readonly collection: string;
  readonly id: string;
  readonly locale: string | null;
}

interface PanelRouteContext {
  readonly input: unknown;
  readonly ui?: { readonly entry?: PanelEntry };
}

interface TaxonomyDef {
  readonly name: string;
  readonly label: string;
  readonly collections: readonly string[];
}

interface EntryTerm extends TermInfo {
  readonly taxonomy: string;
}

interface LocaleOptions {
  locale?: string;
}

/** The parts of the EmDash plugin context that the panel reads. */
interface PanelPluginContext {
  readonly content: {
    get(
      collection: string,
      id: string
    ): Promise<{ readonly data: Record<string, unknown> } | null>;
  };
  readonly taxonomies: {
    getAll(options?: LocaleOptions): Promise<readonly TaxonomyDef[]>;
    getTerms(
      taxonomy: string,
      options?: LocaleOptions
    ): Promise<readonly TermInfo[]>;
    getEntryTerms(
      collection: string,
      entryId: string,
      options?: LocaleOptions & { taxonomy?: string }
    ): Promise<readonly EntryTerm[]>;
    addEntryTerms(
      collection: string,
      entryId: string,
      taxonomy: string,
      termIds: string[]
    ): Promise<readonly EntryTerm[]>;
  };
}

interface CheckboxField {
  type: "checkbox";
  action_id: string;
  label: string;
  options: { label: string; value: string }[];
}

type Block =
  | {
      type: "form";
      block_id: string;
      fields: CheckboxField[];
      submit: { label: string; action_id: string };
    }
  | { type: "context"; text: string }
  | { type: "empty"; size: "sm"; title: string; description: string };

interface PanelResponse {
  blocks: Block[];
  toast?: { message: string; type: "success" | "info" };
  navigate?: {
    kind: "content";
    collection: string;
    id: string;
    locale?: string;
  };
}

interface FormSubmit {
  type: "form_submit";
  action_id: string;
  values: Record<string, unknown>;
}

interface StandardPlugin {
  routes: Record<
    string,
    {
      permission: string;
      handler(
        routeCtx: PanelRouteContext,
        ctx: PanelPluginContext
      ): Promise<PanelResponse>;
    }
  >;
}

interface PanelState {
  taxonomies: TaxonomyTerms[];
  text: string;
  assigned: EntryTerm[];
}

function localeOptions({ locale }: PanelEntry): LocaleOptions {
  return locale === null ? {} : { locale };
}

async function loadState(
  ctx: PanelPluginContext,
  entry: PanelEntry
): Promise<PanelState> {
  const options = localeOptions(entry);
  const item = await ctx.content.get(entry.collection, entry.id);
  const defs = await ctx.taxonomies.getAll(options);
  const assigned = await ctx.taxonomies.getEntryTerms(
    entry.collection,
    entry.id,
    options
  );
  const taxonomies: TaxonomyTerms[] = [];
  for (const { name, label, collections } of defs) {
    if (!collections.includes(entry.collection)) continue;
    taxonomies.push({
      name,
      label,
      terms: await ctx.taxonomies.getTerms(name, options),
    });
  }
  const text = topicText({ id: entry.id, data: item?.data ?? {} });
  return { taxonomies, text, assigned: [...assigned] };
}

function checkboxGroup(
  { name, label }: TaxonomyTerms,
  suggestions: readonly TermSuggestion[]
): CheckboxField {
  return {
    type: "checkbox",
    action_id: name,
    label,
    options: suggestions.map((suggestion) => ({
      label: optionLabel(suggestion),
      value: suggestion.termId,
    })),
  };
}

/**
 * The term label and the words of the entry that matched it. A checkbox
 * option of Block Kit has only `label` and `value` (emdash 1.3.1), so the
 * words go into the label.
 */
function optionLabel({ label, matchedWords }: TermSuggestion): string {
  return matchedWords.length === 0
    ? label
    : `${label}: ${matchedWords.join(", ")}`;
}

function empty(title: string, description: string): Block {
  return { type: "empty", size: "sm", title, description };
}

function mainBlock(
  taxonomies: readonly TaxonomyTerms[],
  fields: CheckboxField[],
  matched: boolean
): Block {
  if (taxonomies.length === 0) {
    return empty(
      "No taxonomies",
      "Add a taxonomy to this collection to get suggestions."
    );
  }
  if (taxonomies.every(({ terms }) => terms.length === 0)) {
    return empty("No terms", "Add terms to the taxonomies of this collection.");
  }
  if (fields.length === 0 && matched) {
    return empty(
      "No new suggestions",
      "The entry has each term that matches its saved text."
    );
  }
  if (fields.length === 0) {
    return empty(
      "No suggestions",
      "No term matches the saved text of this entry."
    );
  }
  return {
    type: "form",
    block_id: "suggestions",
    fields,
    submit: { label: "Add selected terms", action_id: "add_terms" },
  };
}

function render({ taxonomies, text, assigned }: PanelState): Block[] {
  const assignedIds = new Set(assigned.map(({ id }) => id));
  const matches = suggestTerms(taxonomies, text);
  const suggestions = matches.filter(({ termId }) => !assignedIds.has(termId));
  const fields = taxonomies
    .map((taxonomy) =>
      checkboxGroup(
        taxonomy,
        suggestions.filter((s) => s.taxonomy === taxonomy.name)
      )
    )
    .filter((field) => field.options.length > 0);
  const blocks = [mainBlock(taxonomies, fields, matches.length > 0)];
  if (assigned.length > 0) {
    const labels = assigned.map(({ label }) => label).join(", ");
    blocks.push({ type: "context", text: `Assigned terms: ${labels}` });
  }
  const terms = taxonomies.flatMap((taxonomy) => taxonomy.terms);
  if (terms.some((term) => termDescription(term) === undefined)) {
    blocks.push({
      type: "context",
      text: "Some terms have no description. Descriptions improve suggestions.",
    });
  }
  return blocks;
}

function isAddTerms(input: unknown): input is FormSubmit {
  const submit = input as Partial<FormSubmit> | null;
  return (
    submit?.type === "form_submit" &&
    submit.action_id === "add_terms" &&
    typeof submit.values === "object" &&
    submit.values !== null
  );
}

/**
 * The submitted ids that are terms of the taxonomy and not assigned yet.
 * The values come from the browser, so the ids are checked here.
 */
function selectedIds(
  { terms }: TaxonomyTerms,
  value: unknown,
  assigned: readonly EntryTerm[]
): string[] {
  if (!Array.isArray(value)) return [];
  const chosen = new Set<unknown>(value);
  for (const { id } of assigned) chosen.delete(id);
  return terms.map(({ id }) => id).filter((id) => chosen.has(id));
}

async function addSelected(
  ctx: PanelPluginContext,
  entry: PanelEntry,
  state: PanelState,
  values: Record<string, unknown>
): Promise<{ added: number; assigned: EntryTerm[] }> {
  let added = 0;
  let assigned = state.assigned;
  for (const taxonomy of state.taxonomies) {
    const { name } = taxonomy;
    const ids = selectedIds(taxonomy, values[name], assigned);
    if (ids.length === 0) continue;
    const terms = await ctx.taxonomies.addEntryTerms(
      entry.collection,
      entry.id,
      name,
      ids
    );
    const others = assigned.filter(({ taxonomy }) => taxonomy !== name);
    assigned = [...others, ...terms];
    added += ids.length;
  }
  return { added, assigned };
}

/**
 * EmDash gives the status and the message of an error with this name and
 * a `code` and `status` to the caller (emdash 1.3.1 `route-error.ts`).
 */
function badRequest(message: string): Error {
  return Object.assign(new Error(message), {
    name: "PluginRouteError",
    code: "BAD_REQUEST",
    status: 400,
  });
}

async function panelRoute(
  routeCtx: PanelRouteContext,
  ctx: PanelPluginContext
): Promise<PanelResponse> {
  // Only EmDash sets `ui.entry`, after it checks that the user can edit
  // the entry. A direct call to the route does not have it.
  const entry = routeCtx.ui?.entry;
  if (!entry) throw badRequest("Open this panel from the entry editor.");
  const state = await loadState(ctx, entry);
  if (!isAddTerms(routeCtx.input)) return { blocks: render(state) };
  const { added, assigned } = await addSelected(
    ctx,
    entry,
    state,
    routeCtx.input.values
  );
  const blocks = render({ ...state, assigned });
  if (added === 0) {
    return {
      blocks,
      toast: { message: "Select a term to add.", type: "info" },
    };
  }
  return {
    blocks,
    toast: {
      message: `Added ${added} ${added === 1 ? "term" : "terms"}.`,
      type: "success",
    },
    // `refresh` does not reload the taxonomy field of the editor (emdash
    // 1.3.1 `handlePluginEntryRefresh` skips the "entry-terms" queries).
    // That field saves its whole list, so a later edit there would remove
    // the new terms. A reload of the entry shows them.
    navigate: {
      kind: "content",
      collection: entry.collection,
      id: entry.id,
      ...localeOptions(entry),
    },
  };
}

export default {
  routes: {
    panel: { permission: "content:edit_own", handler: panelRoute },
  },
} satisfies StandardPlugin;
