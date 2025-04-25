from functools import partial, cache
from lark import Lark
from llama_cpp import Llama
from typing import Callable
import heapq
import lark
import numpy as np
import argparse
import os
import json


TOP_K = 50
NUM_STEPS = 16


parser = Lark(
    """
    ?start: object

    ?value: object
        | array
        | string
        | "true"             -> true
        | "false"            -> false
        | "null"             -> null

    array  : "[" [value ("," value)*] "]"
    object : "{" pair ("," pair)* "}"
    pair   : string ":" value

    letter: "a" | "b" | "c" | "d" | "e" | "f"
        | "i" | "j" | "k" | "l" | "m" | "n"
        | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v"
        | "w" | "x" | "y" | "z" | "_"

    string : "\\"" letter+ "\\""
    """,
    start="start",
    parser="lalr",
    debug=True,
)


EXAMPLE_PHRASES = [
    b"The letter after 'A' is?",
    b"1 + 2 + 3 = <?>",
    b'if __name__ == "__ma',
    b"My favorite place is the beach. ",
    b"""
    # Set the version of Python and other tools you might need
    build:
    os: ubuntu-2
    """,
    b"""
        [notes] A    A    A     A     A      B-B-A
        [words] If you, if you could return

        [notes] A          A   B   B-A
        [words] Don't let it burn

        [notes]
    """,
    b"abcdefghi",
    b"Hello my name is ",
    b"Translate the following English text to French: 'Hello, world!'",
    b"Write a short story about a robot who dreams of becoming a chef.",
    b"What is the capital of Australia?",
    b"Explain the concept of quantum entanglement in simple terms.",
    b"Generate a list of 5 creative names for a new coffee shop.",
    b"import pandas as pd\ndf = pd.DataFrame(",
    b"def calculate_area(radius):",
    b"The quick brown fox jumps over the lazy ",
    b"Once upon a time, in a land far, far away,",
    b"To be or not to be, that is the ",
    b"Roses are red, violets are ",
    b"The meaning of life is ",
    b"```python\nclass MyClass:\n    def __init__(self):\n",
    b"Solve the equation: 2x + 5 = 15",
    b"What are the main benefits of using renewable energy?",
    b"Describe the process of photosynthesis.",
    b"Write a haiku about the moon.",
    b"List the planets in our solar system in order from the sun.",
    b"Who painted the Mona Lisa?",
    b"What is the chemical formula for water?",
    b"Convert 100 degrees Celsius to Fahrenheit.",
    b"Write a function that reverses a string.",
    b"Explain the difference between HTTP and HTTPS.",
    b"What is the tallest mountain in the world?",
    b"Generate a JSON object representing a user profile.",
]

@cache
def get_llm(model_path: str) -> Llama:
    """Initializes and returns a cached Llama instance."""
    print(f"Loading Llama model from: {model_path}")
    return Llama(
        model_path=model_path,
        n_gpu_layers=-1,
        seed=1337,
        verbose=False,
    )

def _softmax_and_sample(
    input_tokens,
    input_logits,
    *,
    input_length: int,
    id_string: str,
    step_index: int,
    output_dir: str,
    llm: Llama,
    num_tokens: int,
    fake_eos: int,
):
    shifted_logits = input_logits - np.max(input_logits)
    exp_logits = np.exp(shifted_logits)
    probs = exp_logits / np.sum(exp_logits)

    sampled_index = np.random.choice(len(probs), p=probs)
    logits = np.full_like(probs, -np.inf)
    logits[sampled_index] = 0.0

    return logits


def _record_logits(
    input_tokens,
    logits,
    *,
    input_length: int,
    id_string: str,
    step_index: int,
    output_dir: str,
    llm: Llama,
    num_tokens: int,
    fake_eos: int,
):

    actual_k = min(TOP_K, len(logits))


    top_indices = np.argsort(logits)[-actual_k:]


    top_logits_values = logits[top_indices]



    sorted_order = np.argsort(top_logits_values)[::-1]
    top_indices_sorted = top_indices[sorted_order]
    top_logits_values_sorted = top_logits_values[sorted_order]


    top_data = np.stack((top_indices_sorted, top_logits_values_sorted), axis=-1)

    filename = f"{id_string}-step{step_index}.npy"
    filepath = os.path.join(output_dir, filename)
    print(f"Saving top {actual_k} logits (index, value) to: {filepath}")
    np.save(filepath, top_data)

    return logits


def _rollout(
    context_tokens: list[int],
    logit_processors: list,
    num_steps: int,
    llm: Llama,
    fake_eos: int,
) -> list[int]:
    generated_tokens = []
    for step_index in range(num_steps):
        si = len(context_tokens) - 1
        llm.reset()

        llm.eval(context_tokens)


        current_step_processors = [
            partial(processor.func, **{**processor.keywords, "step_index": step_index})
            for processor in logit_processors
        ]

        k = llm.sample(
            idx=si,
            logits_processor=current_step_processors,
            temp=0.0,
            grammar=None,
        )
        context_tokens.append(k)
        generated_tokens.append(k)
        print(llm.detokenize(context_tokens))
        if k == fake_eos:
            break

    return context_tokens


def _grammar_constrain(
    input_tokens,
    input_logits,
    *,
    input_length: int,
    id_string: str,
    step_index: int,
    output_dir: str,
    llm: Llama,
    num_tokens: int,
    fake_eos: int,
):
    token_queue = []
    for token_index, logit in enumerate(input_logits):
        token_queue.append((-logit, token_index))

    heapq.heapify(token_queue)

    generated_tokens = input_tokens[input_length:]
    generated_string_so_far = llm.detokenize(generated_tokens)
    found_matches = 0
    new_logits = np.full_like(input_logits, -np.inf)

    while token_queue and found_matches < TOP_K:
        neg_logit, token_index = heapq.heappop(token_queue)
        candidate_string = llm.detokenize([*generated_tokens, token_index])

        try:
            if candidate_string == generated_string_so_far:
                continue

            interactive = parser.parse_interactive(candidate_string.decode())
            parsed_tokens = []

            for token in interactive.iter_parse():
                parsed_tokens.append(token)

            new_logits[token_index] = -neg_logit
            found_matches += 1
        except (
            lark.exceptions.UnexpectedCharacters,
            lark.exceptions.UnexpectedToken,
            UnicodeDecodeError,

        ):
            continue

    if found_matches == 0:
        new_logits[fake_eos] = 0

    return new_logits



SAMPLER_STRATEGIES = {
    "greedy": [
        _record_logits,
    ],
    "distribution": [
        _record_logits,
        _softmax_and_sample,
    ],
    "grammar_greedy": [
        _grammar_constrain,
        _record_logits,
    ],
    "grammar_distribution": [
        _grammar_constrain,
        _record_logits,
        _softmax_and_sample,
    ],
}


def _logit_processors(
    strategy: str,
    input_: list[int],
    id_string: str,
    output_dir: str,
    llm: Llama,
    num_tokens: int,
    fake_eos: int,
) -> list[Callable]:

    return [
        partial(
            fn,
            input_length=len(input_),
            id_string=id_string,
            step_index=0,
            output_dir=output_dir,
            llm=llm,
            num_tokens=num_tokens,
            fake_eos=fake_eos,
        )
        for fn in SAMPLER_STRATEGIES[strategy]
    ]

def _write_vocab_file(output_path: str, llm: Llama, num_tokens: int):
    """Writes the model's vocabulary to a JSON file."""
    output_array = ["|unk|"] * num_tokens
    for i in range(num_tokens):
        try:

            output_array[i] = llm.detokenize([i]).decode()
        except Exception:
            pass

    with open(output_path, "w") as f:
        json.dump(output_array, f)


def _safe_detokenize(token_indices: list[int], llm: Llama) -> str:
    """Safely detokenizes, returning '|unk|' on error."""
    try:

        return llm.detokenize(token_indices).decode()
    except UnicodeDecodeError:
        return "|unk|"


def main():
    parser = argparse.ArgumentParser(
        description="Run LLM sampling with different strategies and save logits."
    )
    parser.add_argument(
        "--model-path",
        required=True,
        help="Path to the GGUF model file.",
    )
    parser.add_argument(
        "--output-dir",
        required=True,
        help="Directory to save the output logits (.npy files).",
    )
    args = parser.parse_args()
    llm_instance = get_llm(args.model_path)

    num_tokens = llm_instance.n_vocab()
    fake_eos = num_tokens - 1

    os.makedirs(args.output_dir, exist_ok=True)
    vocab_path = os.path.join(args.output_dir, "vocab.json")
    _write_vocab_file(vocab_path, llm_instance, num_tokens)

    for strategy in SAMPLER_STRATEGIES:
        for pidx, phrase in enumerate(EXAMPLE_PHRASES):
            id_string = f"{strategy}-phrase{pidx}"

            id_path = os.path.join(args.output_dir, id_string)
            os.makedirs(id_path, exist_ok=True)

            input_tokens = list(llm_instance.tokenize(phrase))
            context_tokens = list(input_tokens)

            logit_processor_list = _logit_processors(
                strategy,
                context_tokens,
                id_string,
                id_path,
                llm_instance,
                num_tokens,
                fake_eos,
            )
            context_tokens = _rollout(
                context_tokens.copy(),
                logit_processor_list,
                num_steps=NUM_STEPS,
                llm=llm_instance,
                fake_eos=fake_eos,
            )

            completion_tokens = context_tokens[len(input_tokens):]


            output_data = {
                "id": id_string,
                "input_string": phrase.decode(errors='replace'),
                "input_tokens": input_tokens,
                "completion_tokens": completion_tokens,
                "completion_strings": [
                    _safe_detokenize([context_token], llm_instance)
                    for context_token in completion_tokens
                ],
                "full_completion_string": _safe_detokenize(completion_tokens, llm_instance),
                "num_steps": len(completion_tokens),
                "max_steps_requested": NUM_STEPS,
                "model_path": args.model_path,
                "strategy": strategy,
            }
            output_json_path = os.path.join(id_path, "index.json")
            with open(output_json_path, "w") as f:
                json.dump(output_data, f, indent=2)



if __name__ == "__main__":
    main()
