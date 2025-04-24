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

export interface RenderData {
  originalLogits: LogitsSequence;
  tokens: Vocabulary;
  sampledCharacters: Completion;
}
/**
 * Load the vocabulary from a JSON file.
 */
export async function loadVocabulary(
  basePath: string,
): Promise<Vocabulary> {
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
    const npyPath = `${basePath}/${id}/${id}-step${step}.npy`;
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

export const mockSamplingAnalysisData = (): SamplingAnalysisData[] => {
  const allTokens: Vocabulary = [
    ..."abcdefghijklmn89",
    " ",
    ".",
    ",",
    "!",
    "?",
    "'",
    '"',
    "\n",
    "<|endoftext|>",
  ];
  const numTokens = allTokens.length;

  const singleMockAnalysisData = (
    id: string,
    inputText: string,
  ): SamplingAnalysisData => {
    const sampledCharacters: Completion = inputText.split("");
    const logits: LogitsSequence = [];
    const tokenIndices: LogitsSequence = [];
    const numSteps = sampledCharacters.length;

    for (let i = 0; i < numSteps; i++) {
      const stepLogits: Logits = new Array(numTokens);
      let maxLogit = -Infinity;
      let maxIndex = -1;
      const targetChar = sampledCharacters[i];
      const targetIndex = allTokens.indexOf(targetChar);

      for (let j = 0; j < numTokens; j++) {
        let logit = Math.log(Math.random() + 1e-2) * 1.5;
        if (j === targetIndex) {
          logit = Math.max(logit, 2.0 + Math.random() * 2);
        } else if (
          allTokens[j].toLowerCase() === targetChar.toLowerCase() &&
          targetChar !== allTokens[j]
        ) {
          logit += Math.random() * 1.5;
        } else if (j < 52 && Math.random() < 0.1) {
          logit += Math.random() * 1.0 - 0.5;
        } else if (allTokens[j] === " " && Math.random() < 0.15) {
          logit += Math.random() * 1.0;
        }
        stepLogits[j] = logit;
        if (logit > maxLogit) {
          maxLogit = logit;
          maxIndex = j;
        }
      }

      if (targetIndex !== -1 && targetIndex !== maxIndex) {
        stepLogits[targetIndex] = maxLogit + 0.1 + Math.random() * 0.2;
      } else if (targetIndex === -1) {
        console.warn(
          `Sampled character "${targetChar}" not found in allTokens.`,
        );
        stepLogits[0] = Math.max(stepLogits[0], 1.0);
      }

      tokenIndices.push(new Array(numTokens).fill(0).map((_, idx) => idx));
      logits.push(stepLogits);
    }

    return {
      id,
      inputText: inputText,
      sampledCharacters,
      originalLogitsValues: logits,
      originalLogitTokenIndex: tokenIndices,
      completionTokens: allTokens,
    };
  };

  return [
    singleMockAnalysisData("Hello World", "Hello world!"),
    singleMockAnalysisData("Quick Brown Fox", "The quick brown fox"),
    singleMockAnalysisData("Code Example", "const x = 10;"),
  ];
};
