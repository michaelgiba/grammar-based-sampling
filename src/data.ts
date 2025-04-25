import npyjs from "npyjs";
export type Token = string;
export type Vocabulary = Token[];
export type Logits = number[];
export type LogitsSequence = Logits[];
export type Completion = string[];

export interface SamplingAnalysisData {
  id: string;
  inputText: string;
  sampledCharacters: Completion;
  originalLogitsValues: LogitsSequence; // [logitValue] * 50 * num steps
  originalLogitTokenIndex: LogitsSequence; // [token_index] * 50 * num steps
  completionTokens: Vocabulary;
}

const INVALID_FILES = [
  "grammar_distribution-phrase0-step14.npy",
  "grammar_distribution-phrase0-step14.npy",
  "grammar_distribution-phrase1-step7.npy",
  "grammar_distribution-phrase1-step7.npy",
  "grammar_distribution-phrase10-step12.npy",
  "grammar_distribution-phrase10-step12.npy",
  "grammar_distribution-phrase11-step15.npy",
  "grammar_distribution-phrase11-step15.npy",
  "grammar_distribution-phrase12-step7.npy",
  "grammar_distribution-phrase12-step7.npy",
  "grammar_distribution-phrase13-step14.npy",
  "grammar_distribution-phrase13-step14.npy",
  "grammar_distribution-phrase17-step7.npy",
  "grammar_distribution-phrase17-step7.npy",
  "grammar_distribution-phrase18-step8.npy",
  "grammar_distribution-phrase18-step8.npy",
  "grammar_distribution-phrase2-step9.npy",
  "grammar_distribution-phrase2-step9.npy",
  "grammar_distribution-phrase20-step14.npy",
  "grammar_distribution-phrase20-step14.npy",
  "grammar_distribution-phrase22-step10.npy",
  "grammar_distribution-phrase22-step10.npy",
  "grammar_distribution-phrase23-step13.npy",
  "grammar_distribution-phrase23-step13.npy",
  "grammar_distribution-phrase24-step6.npy",
  "grammar_distribution-phrase24-step6.npy",
  "grammar_distribution-phrase25-step10.npy",
  "grammar_distribution-phrase25-step10.npy",
  "grammar_distribution-phrase27-step13.npy",
  "grammar_distribution-phrase27-step13.npy",
  "grammar_distribution-phrase28-step12.npy",
  "grammar_distribution-phrase28-step12.npy",
  "grammar_distribution-phrase29-step7.npy",
  "grammar_distribution-phrase29-step7.npy",
  "grammar_distribution-phrase30-step10.npy",
  "grammar_distribution-phrase30-step10.npy",
  "grammar_distribution-phrase5-step7.npy",
  "grammar_distribution-phrase5-step7.npy",
  "grammar_distribution-phrase6-step12.npy",
  "grammar_distribution-phrase6-step12.npy",
  "grammar_greedy-phrase10-step10.npy",
  "grammar_greedy-phrase10-step10.npy",
  "grammar_greedy-phrase11-step8.npy",
  "grammar_greedy-phrase11-step8.npy",
  "grammar_greedy-phrase12-step14.npy",
  "grammar_greedy-phrase12-step14.npy",
  "grammar_greedy-phrase15-step14.npy",
  "grammar_greedy-phrase15-step14.npy",
  "grammar_greedy-phrase16-step11.npy",
  "grammar_greedy-phrase16-step11.npy",
  "grammar_greedy-phrase17-step7.npy",
  "grammar_greedy-phrase17-step7.npy",
  "grammar_greedy-phrase18-step11.npy",
  "grammar_greedy-phrase18-step11.npy",
  "grammar_greedy-phrase19-step11.npy",
  "grammar_greedy-phrase19-step11.npy",
  "grammar_greedy-phrase21-step8.npy",
  "grammar_greedy-phrase21-step8.npy",
  "grammar_greedy-phrase23-step14.npy",
  "grammar_greedy-phrase23-step14.npy",
  "grammar_greedy-phrase25-step6.npy",
  "grammar_greedy-phrase25-step6.npy",
  "grammar_greedy-phrase26-step7.npy",
  "grammar_greedy-phrase26-step7.npy",
  "grammar_greedy-phrase28-step6.npy",
  "grammar_greedy-phrase28-step6.npy",
  "grammar_greedy-phrase29-step6.npy",
  "grammar_greedy-phrase29-step6.npy",
  "grammar_greedy-phrase3-step7.npy",
  "grammar_greedy-phrase3-step7.npy",
  "grammar_greedy-phrase30-step14.npy",
  "grammar_greedy-phrase30-step14.npy",
  "grammar_greedy-phrase31-step11.npy",
  "grammar_greedy-phrase31-step11.npy",
  "grammar_greedy-phrase7-step14.npy",
  "grammar_greedy-phrase7-step14.npy",
];

export interface RenderData {
  originalLogits: LogitsSequence;
  tokens: Vocabulary;
  sampledCharacters: Completion;
}
/**
 * Load the vocabulary from a JSON file.
 */
export async function loadVocabulary(basePath: string): Promise<Vocabulary> {
  const vocabRes = await fetch(`${basePath}/vocab.json`);
  if (!vocabRes.ok) {
    throw new Error(`Failed to fetch vocab.json: ${vocabRes.statusText}`);
  }
  const vocabData = await vocabRes.json();

  // Basic validation to ensure it's an array of strings
  if (
    !Array.isArray(vocabData) ||
    !vocabData.every((item) => typeof item === "string")
  ) {
    throw new Error(
      "Invalid vocabulary data format. Expected an array of strings.",
    );
  }

  return vocabData as Vocabulary;
}

/**
 * Load a single sample by ID. Expects:
 *   data/<id>/index.json      → { inputText, completion_strings, tokens, num_steps }
 *   data/<id>/logits0.npy …   → one file per generation step
 */
export async function loadSamplingAnalysisData(
  id: string,
  basePath: string,
): Promise<SamplingAnalysisData> {
  const indexRes = await fetch(`${basePath}/${id}/index.json`);
  if (!indexRes.ok) {
    throw new Error(
      `Failed to fetch index.json for id ${id}: ${indexRes.statusText}`,
    );
  }
  const indexData = await indexRes.json();
  const { input_string, completion_strings, completion_tokens, num_steps } =
    indexData;

  if (typeof num_steps !== "number" || num_steps < 0) {
    throw new Error(`Invalid num_steps received for id ${id}: ${num_steps}`);
  }

  const originalTokenIndicesAndLogits: LogitsSequence = [];
  const loader = new npyjs(); // Instantiate loader once for efficiency

  for (let step = 0; step < num_steps; step++) {
    const fileNaeme = `${id}-step${step}.npy`;
    // Check if the file is in the invalid list
    if (INVALID_FILES.includes(fileNaeme)) {
      break;
    }
    const npyPath = `${basePath}/${id}/${fileNaeme}`;
    try {
      const res = await fetch(npyPath);
      if (!res.ok) {
        break;
        throw new Error(`Failed to fetch ${npyPath}: ${res.statusText}`);
      }
      const buf = await res.arrayBuffer();
      // Use parse method for ArrayBuffer input as per npyjs documentation
      const parsed = loader.parse(buf);
      // parsed.data contains the numerical data, typically as a TypedArray
      // Convert TypedArray to a standard number[] array
      originalTokenIndicesAndLogits.push(
        Array.from(parsed.data as ArrayLike<number>),
      );
    } catch (error) {
      console.error(`Error loading or parsing ${npyPath}:`, error);
      // Depending on requirements, you might want to throw the error,
      // return partial data, or handle it differently. Re-throwing for now.
      throw error;
    }
  }
  // for each of the entries in original TokenIndicesAndLogits, split it into two arrays
  const originalLogitsValues: LogitsSequence = [];
  const originalLogitTokenIndex: LogitsSequence = [];
  for (const logits of originalTokenIndicesAndLogits) {
    const logitValues: Logits = [];
    const tokenIndices: Logits = [];
    for (let i = 0; i < Math.min(logits.length, num_steps * 2); i += 2) {
      tokenIndices.push(logits[i]);
      logitValues.push(logits[i + 1]);
    }
    originalLogitsValues.push(logitValues);
    originalLogitTokenIndex.push(tokenIndices);
  }

  // Basic validation for completion_strings and tokens
  const sampledCharacters: Completion = Array.isArray(completion_strings)
    ? completion_strings
    : [];

  return {
    id,
    inputText: input_string,
    sampledCharacters,
    originalLogitsValues,
    originalLogitTokenIndex,
    completionTokens: Array.isArray(completion_tokens) ? completion_tokens : [],
  };
}

/**
 * Load multiple samples by their IDs.
 */
export async function loadAllSamplingAnalysisData(
  ids: string[],
  basePath: string,
): Promise<SamplingAnalysisData[]> {
  return Promise.all(ids.map((id) => loadSamplingAnalysisData(id, basePath)));
}
